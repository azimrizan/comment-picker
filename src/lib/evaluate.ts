import { aiAvailable, aiReadScores } from "./ai";
import { contestRules, getContest, getFollowers, participantCounts } from "./contests";
import { all, audit, batch, nowIso, stmt } from "./db";
import {
  aggregateParticipants,
  evaluateComment,
  validateRules,
  type CommentInput,
  type EvalContext,
  type EvaluatedComment,
} from "./rules/engine";
import type { ScorePredictionRule } from "./rules/types";
import { normalizeUsername } from "./text";

export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(" "));
  }
}

export async function runChecks(contestId: number) {
  const contest = await getContest(contestId);
  if (!contest) throw new Error("Contest not found");
  const cfg = contestRules(contest);
  const errors = validateRules(cfg);
  if (errors.length) throw new ValidationError(errors);

  const host = normalizeUsername(contest.host_username ?? "");
  const comments = await all<CommentInput>(
    "SELECT id, parent_id, username, user_id, text, timestamp, hidden, deleted FROM comments WHERE contest_id = ?",
    contestId,
  );
  const isEntry = (c: CommentInput) =>
    normalizeUsername(c.username) !== host && Boolean(c.username) && (cfg.includeReplies || !c.parent_id);
  const entries = comments.filter(isEntry);

  const followers = await getFollowers(contestId);
  const ctx: EvalContext = {
    hostUsername: host,
    followers: followers?.set ?? null,
    followersUploadedAt: followers?.uploadedAt ?? null,
    aiScores: new Map(),
  };

  let evaluated: EvaluatedComment[] = entries.map((c) => ({ ...c, eval: evaluateComment(c, cfg, ctx) }));

  // Second pass: let the AI read predictions the parser was unsure about.
  let aiRead = 0;
  let aiError: string | null = null;
  const aiRules = cfg.rules.filter((r): r is ScorePredictionRule => r.enabled && r.type === "score_prediction" && r.useAI);
  if (aiRules.length) {
    if (!aiAvailable()) aiError = "AI fallback is on but ANTHROPIC_API_KEY is not set - unclear predictions left for manual review.";
    else {
      try {
        for (const rule of aiRules) {
          const needs = evaluated.filter((c) => c.eval.results.some((r) => r.ruleId === rule.id && r.aiEligible));
          if (!needs.length) continue;
          const scores = await aiReadScores(rule, needs.map((c) => ({ key: `${rule.id}:${c.id}`, text: c.text })));
          for (const [k, v] of scores) ctx.aiScores.set(k, v);
          aiRead += scores.size;
        }
        if (aiRead) evaluated = entries.map((c) => ({ ...c, eval: evaluateComment(c, cfg, ctx) }));
      } catch (e) {
        aiError = `AI fallback failed (${(e as Error).message}) - unclear predictions left for manual review.`;
      }
    }
  }

  const participants = aggregateParticipants(evaluated, cfg);
  // One atomic batch = one round trip to the database, even for thousands of comments.
  await batch([
    stmt("UPDATE comments SET eval_status = 'skipped', eval_json = NULL WHERE contest_id = ?", contestId),
    ...evaluated.map((c) =>
      stmt("UPDATE comments SET eval_status = ?, eval_json = ? WHERE contest_id = ? AND id = ?", c.eval.status, JSON.stringify(c.eval.results), contestId, c.id),
    ),
    stmt("DELETE FROM participants WHERE contest_id = ?", contestId),
    ...participants.map((p) =>
      stmt(
        "INSERT INTO participants (contest_id, user_key, username, auto_status, comment_id, comment_count, reasons_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
        contestId,
        p.userKey,
        p.username,
        p.autoStatus,
        p.commentId,
        p.commentCount,
        JSON.stringify(p.reasons),
      ),
    ),
    stmt("UPDATE contests SET evaluated_at = ? WHERE id = ?", nowIso(), contestId),
  ]);

  const summary = {
    comments: comments.length,
    entries: entries.length,
    skipped: comments.length - entries.length,
    aiRead,
    aiError,
    ...(await participantCounts(contestId)),
  };
  await audit(contestId, "checks_run", summary);
  return summary;
}
