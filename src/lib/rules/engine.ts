import {
  containsPhrase,
  extractMentions,
  foldCase,
  levenshtein,
  normalizeUsername,
  parseIgTime,
  stripMentions,
  words,
} from "../text";
import { parseScore, type ScoreReading } from "./score";
import type {
  AnswerRule,
  ContestRules,
  ParticipantStatus,
  Rule,
  RuleResult,
  ScorePredictionRule,
  Status,
} from "./types";

export interface CommentInput {
  id: string;
  parent_id: string | null;
  username: string;
  user_id: string | null;
  text: string;
  timestamp: string;
  hidden: number;
  deleted: number;
}

export interface AiScore {
  home: number | null;
  away: number | null;
  confident: boolean;
  note: string;
}

export interface EvalContext {
  hostUsername: string;
  followers: Set<string> | null;
  followersUploadedAt: string | null;
  /** keyed by `${ruleId}:${commentId}` */
  aiScores: Map<string, AiScore>;
}

export interface CommentEval {
  status: Status;
  results: RuleResult[];
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";

export function validateRules(cfg: ContestRules): string[] {
  const errors: string[] = [];
  for (const r of cfg.rules) {
    if (!r.enabled) continue;
    switch (r.type) {
      case "deadline":
        if (!r.end) errors.push("Comment time window: set an end time (deadline).");
        if (r.start && r.end && Date.parse(r.start) >= Date.parse(r.end)) errors.push("Comment time window: start must be before end.");
        break;
      case "mentions":
        if (!(r.min >= 1)) errors.push("Tag friends: minimum must be at least 1.");
        if (r.max != null && r.max < r.min) errors.push("Tag friends: maximum is below minimum.");
        break;
      case "keywords":
        if (!r.terms.length) errors.push("Required hashtags / words: add at least one term.");
        break;
      case "forbidden_words":
        if (!r.terms.length) errors.push("Forbidden words: add at least one term.");
        break;
      case "min_words":
        if (!(r.count >= 1)) errors.push("Minimum words: must be at least 1.");
        break;
      case "score_prediction":
        if (!r.homeAliases.length || !r.awayAliases.length)
          errors.push("Score prediction: add names/aliases for both teams.");
        if ((r.homeScore == null) !== (r.awayScore == null))
          errors.push("Score prediction: enter both home and away goals (or leave both empty).");
        break;
      case "answer":
        if (!r.label.trim()) errors.push("Correct answer: give the question a label.");
        break;
    }
  }
  return errors;
}

function ruleResult(rule: Rule, status: Status, reason: string, evidence?: Record<string, unknown>, aiEligible?: boolean): RuleResult {
  return { ruleId: rule.id, type: rule.type, status, reason, evidence, aiEligible };
}

function checkScore(rule: ScorePredictionRule, c: CommentInput, ctx: EvalContext): RuleResult {
  const parsed = parseScore(c.text, rule);
  let readings: ScoreReading[] = parsed.readings;
  const ai = ctx.aiScores.get(`${rule.id}:${c.id}`);

  if (!readings.length) {
    if (ai) {
      if (!ai.confident) return ruleResult(rule, "review", `AI unsure: ${ai.note}`, { ai });
      if (ai.home == null || ai.away == null) return ruleResult(rule, "fail", `No score prediction (AI-read: ${ai.note})`, { ai });
      readings = [{ home: ai.home, away: ai.away, orientation: "ai", raw: "AI" }];
    } else if (!parsed.hasDigits) {
      return ruleResult(rule, "fail", "No score prediction found");
    } else {
      return ruleResult(rule, "review", "Has numbers but no clear score format", undefined, true);
    }
  }

  const shown = readings.map((r) => `${r.home}-${r.away}`).join(", ");
  if (readings.length > 1) {
    return ruleResult(rule, rule.multiple, `Multiple different scores predicted: ${shown}`, { prediction: shown });
  }
  const r = readings[0];
  const evidence = { prediction: `${r.home}-${r.away}`, orientation: r.orientation };
  if (rule.homeScore == null || rule.awayScore == null) {
    return ruleResult(rule, "review", `Predicted ${rule.homeTeam} ${r.home}-${r.away} ${rule.awayTeam}; result not entered yet`, evidence);
  }
  const correct = r.home === rule.homeScore && r.away === rule.awayScore;
  if (r.orientation === "assumed" && r.home !== r.away && parsed.mentionsTeam) {
    const swappedCorrect = r.away === rule.homeScore && r.home === rule.awayScore;
    if (swappedCorrect !== correct) {
      if (ai?.confident && ai.home != null && ai.away != null) {
        const aiCorrect = ai.home === rule.homeScore && ai.away === rule.awayScore;
        return ruleResult(rule, aiCorrect ? "pass" : "fail", `AI-read order: ${ai.home}-${ai.away} (${ai.note})`, { ...evidence, ai });
      }
      return ruleResult(rule, "review", `Score order unclear: "${r.raw}" could be ${r.home}-${r.away} or ${r.away}-${r.home}`, evidence, true);
    }
  }
  return correct
    ? ruleResult(rule, "pass", `Correct: ${rule.homeTeam} ${r.home}-${r.away} ${rule.awayTeam}`, evidence)
    : ruleResult(rule, "fail", `Wrong score: predicted ${r.home}-${r.away}, actual ${rule.homeScore}-${rule.awayScore}`, evidence);
}

function splitAliases(line: string) {
  return line.split("|").map((s) => s.trim()).filter(Boolean);
}

function fuzzyHit(text: string, aliases: string[]): string | null {
  const ws = words(text);
  for (const alias of aliases) {
    const a = foldCase(alias);
    if (!/^[a-z]{5,}$/.test(a)) continue; // only single latin words of 5+ letters
    const maxDist = a.length >= 9 ? 2 : 1;
    const w = ws.find((w) => /^[a-z]+$/.test(w) && Math.abs(w.length - a.length) <= maxDist && levenshtein(w, a) <= maxDist);
    if (w) return `${w} ≈ ${alias}`;
  }
  return null;
}

function checkAnswer(rule: AnswerRule, c: CommentInput): RuleResult {
  const groups = rule.correct.map(splitAliases).filter((g) => g.length);
  if (!groups.length) return ruleResult(rule, "review", `${rule.label}: correct answer not entered yet`);
  const text = stripMentions(c.text).replace(/#/g, " ");
  const correctSet = new Set(groups.flat().map((a) => foldCase(a)));
  const otherGroups = rule.others
    .map(splitAliases)
    .map((g) => g.filter((a) => !correctSet.has(foldCase(a))))
    .filter((g) => g.length);

  const exact = groups.map((g) => g.some((a) => containsPhrase(text, a)));
  const fuzzy = groups.map((g, i) => (!exact[i] && rule.fuzzy ? fuzzyHit(text, g) : null));
  const others = otherGroups.filter((g) => g.some((a) => containsPhrase(text, a))).map((g) => g[0]);

  const need = rule.mode === "all" ? groups.every((_, i) => exact[i]) : exact.some(Boolean);
  const nearly = rule.mode === "all" ? groups.every((_, i) => exact[i] || fuzzy[i]) : fuzzy.some(Boolean);
  const evidence = { others, fuzzy: fuzzy.filter(Boolean) };

  if (need) {
    if (others.length) return ruleResult(rule, rule.multiple, `${rule.label}: also names ${others.join(", ")}`, evidence);
    return ruleResult(rule, "pass", `${rule.label}: correct`, evidence);
  }
  if (nearly) return ruleResult(rule, "review", `${rule.label}: possible misspelling (${fuzzy.filter(Boolean).join("; ")})`, evidence);
  if (others.length) return ruleResult(rule, "fail", `${rule.label}: wrong answer (${others.join(", ")})`, evidence);
  return ruleResult(rule, "fail", `${rule.label}: correct answer not found`, evidence);
}

export function evaluateComment(c: CommentInput, cfg: ContestRules, ctx: EvalContext): CommentEval {
  const results: RuleResult[] = [];
  const username = normalizeUsername(c.username);
  const host = normalizeUsername(ctx.hostUsername);

  if (c.deleted) {
    results.push({ ruleId: "system", type: "not_hidden", status: "fail", reason: "Comment no longer exists on the post" });
  }

  for (const rule of cfg.rules) {
    if (!rule.enabled) continue;
    switch (rule.type) {
      case "deadline": {
        const t = parseIgTime(c.timestamp);
        if (!rule.end) results.push(ruleResult(rule, "review", "Deadline not configured"));
        else if (rule.start && t < Date.parse(rule.start)) results.push(ruleResult(rule, "fail", `Commented before the start (${fmt(c.timestamp)})`));
        else if (t > Date.parse(rule.end)) results.push(ruleResult(rule, "fail", `Commented after the deadline (${fmt(c.timestamp)})`));
        else results.push(ruleResult(rule, "pass", `Commented on time (${fmt(c.timestamp)})`));
        break;
      }
      case "must_follow": {
        if (!ctx.followers) results.push(ruleResult(rule, "review", "Followers list not uploaded yet"));
        else if (ctx.followers.has(username)) results.push(ruleResult(rule, "pass", "Follows the account"));
        else results.push(ruleResult(rule, "fail", `Not in followers export${ctx.followersUploadedAt ? ` (uploaded ${fmt(ctx.followersUploadedAt)})` : ""}`));
        break;
      }
      case "mentions": {
        const excluded = new Set(rule.excludeAccounts.map(normalizeUsername));
        const valid: string[] = [];
        const ignored: string[] = [];
        for (const m of extractMentions(c.text)) {
          if (valid.includes(m)) continue;
          if ((rule.excludeSelf && m === username) || (rule.excludeHost && m === host) || excluded.has(m)) {
            if (!ignored.includes(m)) ignored.push(m);
          } else valid.push(m);
        }
        const ev = { valid, ignored };
        const ign = ignored.length ? ` (ignored: ${ignored.map((x) => "@" + x).join(", ")})` : "";
        if (valid.length < rule.min) results.push(ruleResult(rule, "fail", `Tagged ${valid.length} of ${rule.min} required${ign}`, ev));
        else if (rule.max != null && valid.length > rule.max) results.push(ruleResult(rule, "fail", `Tagged ${valid.length}, maximum is ${rule.max}`, ev));
        else results.push(ruleResult(rule, "pass", `Tagged ${valid.length}: ${valid.map((x) => "@" + x).join(", ")}${ign}`, ev));
        break;
      }
      case "keywords": {
        const missing = rule.terms.filter((t) => !containsPhrase(c.text, t));
        const ok = rule.mode === "all" ? missing.length === 0 : missing.length < rule.terms.length;
        results.push(ok ? ruleResult(rule, "pass", "Contains required words") : ruleResult(rule, "fail", `Missing: ${(rule.mode === "all" ? missing : rule.terms).join(", ")}`));
        break;
      }
      case "forbidden_words": {
        const found = rule.terms.filter((t) => containsPhrase(c.text, t));
        results.push(found.length ? ruleResult(rule, "fail", `Contains forbidden: ${found.join(", ")}`) : ruleResult(rule, "pass", "No forbidden words"));
        break;
      }
      case "min_words": {
        const n = words(stripMentions(c.text)).length;
        results.push(n >= rule.count ? ruleResult(rule, "pass", `${n} words`) : ruleResult(rule, "fail", `Only ${n} words (need ${rule.count})`));
        break;
      }
      case "exclude_users": {
        const banned = rule.usernames.map(normalizeUsername).includes(username);
        results.push(banned ? ruleResult(rule, "fail", "Account is excluded from this contest") : ruleResult(rule, "pass", "Not excluded"));
        break;
      }
      case "not_hidden":
        results.push(c.hidden ? ruleResult(rule, "fail", "Comment is hidden") : ruleResult(rule, "pass", "Visible"));
        break;
      case "score_prediction":
        results.push(checkScore(rule, c, ctx));
        break;
      case "answer":
        results.push(checkAnswer(rule, c));
        break;
    }
  }

  const status: Status = results.some((r) => r.status === "fail")
    ? "fail"
    : results.some((r) => r.status === "review")
      ? "review"
      : "pass";
  return { status, results };
}

export interface EvaluatedComment extends CommentInput {
  eval: CommentEval;
}

export interface ParticipantOut {
  userKey: string;
  username: string;
  autoStatus: ParticipantStatus;
  commentId: string;
  commentCount: number;
  reasons: string[];
}

const toParticipant: Record<Status, ParticipantStatus> = { pass: "eligible", fail: "rejected", review: "review" };

/** Collapse comments into one entry per Instagram user according to the entry policy. */
export function aggregateParticipants(comments: EvaluatedComment[], cfg: ContestRules): ParticipantOut[] {
  const byUser = new Map<string, EvaluatedComment[]>();
  for (const c of comments) {
    const key = c.user_id ?? `u:${normalizeUsername(c.username)}`;
    const list = byUser.get(key) ?? [];
    list.push(c);
    byUser.set(key, list);
  }

  const out: ParticipantOut[] = [];
  for (const [userKey, list] of byUser) {
    list.sort((a, b) => parseIgTime(a.timestamp) - parseIgTime(b.timestamp));
    const live = list.filter((c) => !c.deleted);
    const pool = live.length ? live : list;
    const latestName = list[list.length - 1].username;
    const reasonsOf = (c: EvaluatedComment) => c.eval.results.filter((r) => r.status !== "pass").map((r) => r.reason);

    let chosen: EvaluatedComment;
    let status: ParticipantStatus;
    let reasons: string[];

    if (cfg.entryPolicy === "disqualify_multiple" && live.length > 1) {
      chosen = live[0];
      status = "rejected";
      reasons = [`Multiple entries (${live.length} comments) - not allowed`];
    } else if (cfg.entryPolicy === "first_only") {
      chosen = pool[0];
      status = toParticipant[chosen.eval.status];
      reasons = reasonsOf(chosen);
      if (pool.length > 1) reasons.push(`Only first of ${pool.length} comments counted`);
    } else {
      chosen =
        pool.find((c) => c.eval.status === "pass") ?? pool.find((c) => c.eval.status === "review") ?? pool[0];
      status = toParticipant[chosen.eval.status];
      reasons = reasonsOf(chosen);
    }

    out.push({ userKey, username: latestName, autoStatus: status, commentId: chosen.id, commentCount: live.length, reasons });
  }
  return out;
}
