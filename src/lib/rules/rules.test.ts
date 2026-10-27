import { describe, expect, it } from "vitest";
import { extractMentions, normalizeText, containsPhrase, parseIgTime } from "../text";
import { parseScore } from "./score";
import { aggregateParticipants, evaluateComment, type CommentInput, type EvalContext } from "./engine";
import { defaultRule, type ContestRules, type ScorePredictionRule, type AnswerRule, type MentionsRule } from "./types";

const teams = {
  homeAliases: ["kbfc", "kerala", "blasters", "kerala blasters", "മഞ്ഞപ്പട"],
  awayAliases: ["bfc", "bengaluru", "bengaluru fc", "bangalore"],
};
const score = (t: string) => parseScore(t, teams).readings.map((r) => `${r.home}-${r.away}:${r.orientation}`);

describe("normalizeText / mentions", () => {
  it("folds emoji digits, Malayalam digits and fancy fonts", () => {
    expect(normalizeText("2️⃣-1️⃣")).toBe("2-1");
    expect(normalizeText("൨-൧")).toBe("2-1");
    expect(normalizeText("𝐊𝐁𝐅𝐂 𝟐")).toBe("KBFC 2");
  });
  it("extracts mentions correctly", () => {
    expect(extractMentions("@Ajay_k @ravi.m. and @x hi@notamention")).toEqual(["ajay_k", "ravi.m", "x"]);
    expect(extractMentions("email me a@b.com")).toEqual([]);
  });
  it("matches whole hashtags only", () => {
    expect(containsPhrase("Go #KBFC!", "#kbfc")).toBe(true);
    expect(containsPhrase("Go #KBFCfans", "#kbfc")).toBe(false);
    expect(containsPhrase("മഞ്ഞപ്പട ❤️", "മഞ്ഞപ്പട")).toBe(true);
  });
  it("parses instagram timestamps", () => {
    expect(parseIgTime("2026-10-20T10:00:00+0000")).toBe(Date.parse("2026-10-20T10:00:00Z"));
  });
});

describe("parseScore", () => {
  it("reads bare scores in home-away order", () => {
    expect(score("2-1")).toEqual(["2-1:assumed"]);
    expect(score("my prediction 3 : 0 💛")).toEqual(["3-0:assumed"]);
    expect(score("2️⃣-0️⃣")).toEqual(["2-0:assumed"]);
    expect(score("൩-൧")).toEqual(["3-1:assumed"]);
  });
  it("uses team names for orientation", () => {
    expect(score("KBFC 2-1 BFC")).toEqual(["2-1:explicit"]);
    expect(score("BFC 1-2 KBFC")).toEqual(["2-1:explicit"]);
    expect(score("Bengaluru vs Kerala 0-3")).toEqual(["3-0:explicit"]);
    expect(score("Kerala 2 Bengaluru 1")).toEqual(["2-1:explicit"]);
  });
  it("treats a team named after the score as the winner", () => {
    expect(score("2-1 kbfc")).toEqual(["2-1:winner"]);
    expect(score("2-1 to bfc")).toEqual(["1-2:winner"]);
    expect(score("blasters will win, 3-1")).toEqual(["3-1:winner"]);
    expect(score("bengaluru will lose, 3-1 easy")).toEqual(["1-3:assumed"]);
  });
  it("handles words", () => {
    expect(score("two nil")).toEqual(["2-0:assumed"]);
    expect(score("one all")).toEqual(["1-1:assumed"]);
    expect(score("randu-onnu")).toEqual(["2-1:assumed"]);
    expect(score("kbfc moonu - onnu")).toEqual(["3-1:explicit"]);
    expect(score("രണ്ട് - ഒന്ന്")).toEqual(["2-1:assumed"]);
    expect(score("onnu nokku")).toEqual([]);
  });
  it("ignores times, dates and tagged usernames", () => {
    expect(score("match at 7:30 pm")).toEqual([]);
    expect(score("kickoff 8:00")).toEqual([]);
    expect(score("20-10-2026")).toEqual([]);
    expect(score("@rahul_2-1 hi")).toEqual([]);
  });
  it("collects distinct scores", () => {
    expect(score("2-1 or 3-1")).toEqual(["2-1:assumed", "3-1:assumed"]);
    expect(score("2-1!! yes 2-1")).toEqual(["2-1:assumed"]);
  });
});

function comment(text: string, extra: Partial<CommentInput> = {}): CommentInput {
  return {
    id: Math.random().toString(36).slice(2),
    parent_id: null,
    username: "fan1",
    user_id: "1",
    text,
    timestamp: "2026-10-20T10:00:00+0000",
    hidden: 0,
    deleted: 0,
    ...extra,
  };
}

const ctx: EvalContext = {
  hostUsername: "kbfc_fans",
  followers: new Set(["fan1", "fan2"]),
  followersUploadedAt: "2026-10-21T00:00:00Z",
  aiScores: new Map(),
};

function cfgWith(...rules: ContestRules["rules"]): ContestRules {
  return { includeReplies: false, entryPolicy: "best", rules };
}

describe("evaluateComment", () => {
  it("checks deadline, follow and tags", () => {
    const deadline = { ...defaultRule("deadline"), end: "2026-10-20T12:00:00Z" } as ContestRules["rules"][number];
    const mentions = defaultRule("mentions");
    const cfg = cfgWith(deadline, defaultRule("must_follow"), mentions);

    expect(evaluateComment(comment("@a @b"), cfg, ctx).status).toBe("pass");
    expect(evaluateComment(comment("@a @a"), cfg, ctx).status).toBe("fail"); // duplicate tag
    expect(evaluateComment(comment("@a @fan1"), cfg, ctx).status).toBe("fail"); // self tag
    expect(evaluateComment(comment("@a @kbfc_fans"), cfg, ctx).status).toBe("fail"); // host tag
    expect(evaluateComment(comment("@a @b", { username: "stranger" }), cfg, ctx).status).toBe("fail");
    expect(evaluateComment(comment("@a @b", { timestamp: "2026-10-20T12:00:01+0000" }), cfg, ctx).status).toBe("fail");
  });

  it("marks follow check for review when no list uploaded", () => {
    const r = evaluateComment(comment("hi"), cfgWith(defaultRule("must_follow")), { ...ctx, followers: null });
    expect(r.status).toBe("review");
  });

  it("scores predictions", () => {
    const rule: ScorePredictionRule = { ...(defaultRule("score_prediction") as ScorePredictionRule), awayTeam: "BFC", awayAliases: teams.awayAliases, homeScore: 2, awayScore: 1 };
    const cfg = cfgWith(rule);
    expect(evaluateComment(comment("2-1"), cfg, ctx).status).toBe("pass");
    expect(evaluateComment(comment("BFC 1-2 KBFC"), cfg, ctx).status).toBe("pass");
    expect(evaluateComment(comment("1-2"), cfg, ctx).status).toBe("fail");
    expect(evaluateComment(comment("3-0 kbfc"), cfg, ctx).status).toBe("fail");
    expect(evaluateComment(comment("2-1 or 3-1"), cfg, ctx).status).toBe("review");
    expect(evaluateComment(comment("@a @b"), cfg, ctx).status).toBe("fail");
    // order unclear AND it changes the verdict -> review
    expect(evaluateComment(comment("come on bfc... 2-1"), cfg, ctx).status).toBe("review");
    expect(evaluateComment(comment("come on bfc... 3-0"), cfg, ctx).status).toBe("fail"); // wrong either way
    expect(evaluateComment(comment("2-1 bfc"), cfg, ctx).status).toBe("fail");
  });

  it("checks answers with fuzzy review", () => {
    const rule: AnswerRule = { ...(defaultRule("answer") as AnswerRule), correct: ["Noah Sadaoui|Noah|നോവ"], others: ["Luna", "Jesus Jimenez|Jimenez"] };
    const cfg = cfgWith(rule);
    expect(evaluateComment(comment("noah will score"), cfg, ctx).status).toBe("pass");
    expect(evaluateComment(comment("sadoui"), cfg, ctx).status).toBe("fail");
    expect(evaluateComment(comment("Noah Sadauoi first"), cfg, ctx).status).toBe("pass");
    expect(evaluateComment(comment("Jimenez"), cfg, ctx).status).toBe("fail");
    expect(evaluateComment(comment("Noah or Luna"), cfg, ctx).status).toBe("review");
    expect(evaluateComment(comment("@noah_fan"), cfg, ctx).status).toBe("fail");
  });
});

describe("aggregateParticipants", () => {
  const mentions: MentionsRule = { ...(defaultRule("mentions") as MentionsRule), min: 1 };
  const cfg = cfgWith(mentions);
  const run = (policy: ContestRules["entryPolicy"], comments: CommentInput[]) => {
    const c2 = { ...cfg, entryPolicy: policy };
    return aggregateParticipants(comments.map((c) => ({ ...c, eval: evaluateComment(c, c2, ctx) })), c2);
  };
  const a = comment("no tag", { id: "a", timestamp: "2026-10-20T10:00:00+0000" });
  const b = comment("@friend", { id: "b", timestamp: "2026-10-20T11:00:00+0000" });

  it("best: any passing comment qualifies", () => {
    expect(run("best", [a, b])).toMatchObject([{ autoStatus: "eligible", commentId: "b", commentCount: 2 }]);
  });
  it("first_only: only the first comment counts", () => {
    expect(run("first_only", [b, a])[0].autoStatus).toBe("rejected");
  });
  it("disqualify_multiple", () => {
    expect(run("disqualify_multiple", [a, b])[0].autoStatus).toBe("rejected");
  });
});
