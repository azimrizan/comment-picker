import { foldCase, stripMentions } from "../text";

export type Orientation = "explicit" | "winner" | "assumed" | "ai";

export interface ScoreReading {
  home: number;
  away: number;
  orientation: Orientation;
  raw: string;
}

export interface ScoreParse {
  readings: ScoreReading[]; // distinct by (home, away)
  hasDigits: boolean;
  mentionsTeam: boolean;
}

export interface TeamConfig {
  homeAliases: string[];
  awayAliases: string[];
}

const MAX_GOALS = 20;
const NEAR = 25; // chars between a team name and the score for it to "own" the score

const NUMBER_WORDS: [string[], string][] = [
  [["zero", "poojyam", "pujyam", "poojyam", "പൂജ്യം"], "0"],
  [["one", "onnu", "onn", "ഒന്ന്", "ഒന്നു"], "1"],
  [["two", "randu", "rand", "rendu", "രണ്ട്", "രണ്ടു"], "2"],
  [["three", "moonu", "munnu", "moonnu", "moonn", "മൂന്ന്", "മൂന്നു"], "3"],
  [["four", "naalu", "nalu", "naal", "നാല്", "നാലു"], "4"],
  [["five", "anchu", "anju", "anch", "അഞ്ച്", "അഞ്ചു"], "5"],
  [["six", "aaru", "ആറ്", "ആറു"], "6"],
  [["seven", "ezhu", "ഏഴ്", "ഏഴു"], "7"],
  [["eight", "ettu", "എട്ട്", "എട്ടു"], "8"],
  [["nine", "ombathu", "ഒമ്പത്", "ഒൻപത്"], "9"],
  [["ten", "pathu", "പത്ത്", "പത്തു"], "10"],
];
const WORD_NUMBERS = new Map(NUMBER_WORDS.flatMap(([ws, d]) => ws.map((w) => [w, d] as const)));
const WORD_NUMBER_RE = new RegExp(
  `(?<![\\p{L}\\p{M}])(${[...WORD_NUMBERS.keys()].sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\p{M}])`,
  "gu",
);

const WIN_WORDS = ["win", "wins", "won", "winning", "victory", "jayikkum", "jayam", "ജയിക്കും", "ജയം", "വിജയം"];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasRegex(aliases: string[]): RegExp | null {
  const parts = aliases
    .map((a) => foldCase(a).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((a) => a.split(/\s+/).map(escapeRe).join("\\s+"));
  if (!parts.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${parts.join("|")})(?![\\p{L}\\p{M}\\p{N}_])`, "gu");
}

function positions(re: RegExp | null, s: string): number[] {
  if (!re) return [];
  re.lastIndex = 0;
  return [...s.matchAll(re)].map((m) => m.index!);
}

interface Hit {
  team: "home" | "away";
  start: number;
  end: number;
}

function hits(re: RegExp | null, s: string, team: Hit["team"]): Hit[] {
  if (!re) return [];
  re.lastIndex = 0;
  return [...s.matchAll(re)].map((m) => ({ team, start: m.index!, end: m.index! + m[0].length }));
}

const ADJACENT_GAP = /^(?:\s|[:=\-–(]|\p{Extended_Pictographic}|\uFE0F){0,6}$/u; // "kbfc 2-1", "kbfc: 2-1", "kbfc 💛 2-1" (sentence punctuation breaks it)
const WINNER_GAP = /^[\s\p{P}\p{S}]*(?:(?:to|for)\s+)?$/u; // "2-1 kbfc", "2-1 to kbfc"

export function prepareScoreText(text: string): string {
  let t = foldCase(stripMentions(text)).replace(/#/g, " ");
  t = t.replace(WORD_NUMBER_RE, (w) => WORD_NUMBERS.get(w)!);
  t = t.replace(/(?<![\d])(\d{1,2})\s*-?\s*nil\b/g, "$1-0");
  t = t.replace(/\bnil\s*-?\s*(\d{1,2})(?!\d)/g, "0-$1");
  t = t.replace(/(?<![\d])(\d{1,2})\s+all\b/g, "$1-$1");
  return t;
}

const SCORE_RE =
  /(?<![\d.:/\-–—,])(\d{1,2})\s*(?:-|–|—|:|x|×|vs\.?|v)\s*(\d{1,2})(?![\d.:/\-–—%])(?!\s*(?:am|pm|ist|hrs?|mins?|minutes?)\b)/gu;

function validGoal(s: string) {
  if (s.length === 2 && s.startsWith("0")) return false; // "7:05", "10:00" are times
  return Number(s) <= MAX_GOALS;
}

export function parseScore(text: string, teams: TeamConfig): ScoreParse {
  const t = prepareScoreText(text);
  const homeRe = aliasRegex(teams.homeAliases);
  const awayRe = aliasRegex(teams.awayAliases);
  const teamHits = [...hits(homeRe, t, "home"), ...hits(awayRe, t, "away")].sort((x, y) => x.start - y.start);
  const homePos = teamHits.filter((h) => h.team === "home").map((h) => h.start);
  const awayPos = teamHits.filter((h) => h.team === "away").map((h) => h.start);
  const mentionsTeam = teamHits.length > 0;
  const hasDigits = /\d/.test(t);
  const readings: ScoreReading[] = [];

  const winPos = WIN_WORDS.flatMap((w) => positions(new RegExp(`(?<![\\p{L}\\p{M}])${escapeRe(w)}(?![\\p{L}\\p{M}])`, "gu"), t));

  for (const m of t.matchAll(SCORE_RE)) {
    const [raw, sa, sb] = m;
    if (!validGoal(sa) || !validGoal(sb)) continue;
    const a = Number(sa);
    const b = Number(sb);
    const start = m.index!;
    const end = start + raw.length;

    const before = teamHits.filter((h) => h.end <= start && start - h.end <= NEAR);
    const after = teamHits.filter((h) => h.start >= end && h.start - end <= NEAR);
    const teamsIn = (hs: Hit[]) => new Set(hs.map((h) => h.team));
    const other = (x: Hit["team"]): Hit["team"] => (x === "home" ? "away" : "home");
    const winnerFirst = (winner: Hit["team"]) => (a >= b ? winner : other(winner));

    const homeWins = winPos.some((w) => homePos.some((p) => Math.abs(w - p) <= NEAR));
    const awayWins = winPos.some((w) => awayPos.some((p) => Math.abs(w - p) <= NEAR));
    const lastBefore = before[before.length - 1];
    const firstAfter = after[0];

    let first: Hit["team"];
    let orientation: Orientation = "explicit";

    if (teamsIn(before).size === 2) {
      // "KBFC vs BFC 2-1": first-named team gets the first number.
      first = before[0].team;
    } else if (lastBefore && ADJACENT_GAP.test(t.slice(lastBefore.end, start))) {
      // "KBFC 2-1 BFC", "BFC 1-2 KBFC"
      first = lastBefore.team;
    } else if (teamsIn(after).size === 2) {
      first = after[0].team;
    } else if (firstAfter && WINNER_GAP.test(t.slice(end, firstAfter.start))) {
      // "2-1 KBFC" / "2-1 to KBFC": the named team is the winner.
      orientation = "winner";
      first = winnerFirst(firstAfter.team);
    } else if (homeWins !== awayWins && a !== b) {
      // "Blasters will win, 3-1"
      orientation = "winner";
      first = winnerFirst(homeWins ? "home" : "away");
    } else {
      // Can't tell for sure. The rule sends it to review if the order changes the verdict.
      orientation = "assumed";
      first = lastBefore?.team ?? "home";
    }

    const home = first === "home" ? a : b;
    const away = first === "home" ? b : a;
    if (!readings.some((r) => r.home === home && r.away === away)) {
      readings.push({ home, away, orientation, raw: raw.trim() });
    }
  }

  // "Kerala 2 BFC 1" style, only when no "x-y" score was written.
  if (!readings.length && homeRe && awayRe) {
    const num = (re: RegExp) => {
      const src = new RegExp(`(?:${re.source})\\s*[:=\\-]?\\s*(\\d{1,2})(?![\\d])`, "gu");
      return [...t.matchAll(src)].map((m) => m[1]).filter(validGoal).map(Number);
    };
    const hs = [...new Set(num(homeRe))];
    const as = [...new Set(num(awayRe))];
    if (hs.length === 1 && as.length === 1) {
      readings.push({ home: hs[0], away: as[0], orientation: "explicit", raw: `${hs[0]} / ${as[0]}` });
    }
  }

  return { readings, hasDigits, mentionsTeam };
}
