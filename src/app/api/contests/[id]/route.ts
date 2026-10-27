import { NextResponse } from "next/server";
import { audit, batch, get, run, stmt } from "@/lib/db";
import { contestRules, getContest, getFollowers, participantCounts } from "@/lib/contests";
import { activeDraw } from "@/lib/draw";
import { contestId, handle, HttpError, type IdParams } from "@/lib/http";
import { validateRules } from "@/lib/rules/engine";
import type { ContestRules } from "@/lib/rules/types";
import { aiAvailable } from "@/lib/ai";

export const GET = handle(async (_req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const c = await getContest(id);
  if (!c) throw new HttpError("Contest not found", 404);
  const followers = await getFollowers(id);
  const stats = await get<{ total: number }>(
      `SELECT COUNT(*) AS total,
        SUM(parent_id IS NULL) AS top_level,
        SUM(parent_id IS NOT NULL) AS replies,
        SUM(deleted) AS deleted,
        SUM(hidden) AS hidden,
        COUNT(DISTINCT COALESCE(user_id, username)) AS users
       FROM comments WHERE contest_id = ?`,
      id,
  );
  const fetchStatus = c.fetch_status;
  const draw = await activeDraw(id);
  const rules = contestRules(c);

  return NextResponse.json({
    contest: {
      id: c.id,
      name: c.name,
      postUrl: c.post_url,
      mediaId: c.media_id,
      permalink: c.permalink,
      caption: c.caption,
      mediaType: c.media_type,
      thumbnailUrl: c.thumbnail_url,
      apiCommentsCount: c.api_comments_count,
      hostUsername: c.host_username,
      evaluatedAt: c.evaluated_at,
    },
    rules,
    ruleErrors: validateRules(rules),
    fetch: {
      status: fetchStatus,
      fetched: c.fetch_fetched,
      note: c.fetch_note,
      error: c.fetch_error,
      startedAt: c.fetch_started_at,
      finishedAt: c.fetch_finished_at,
      canResume: Boolean(c.fetch_cursor) && fetchStatus !== "done" && fetchStatus !== "running",
    },
    stats,
    followers: followers && { count: followers.count, uploadedAt: followers.uploadedAt, files: followers.sourceFiles },
    counts: await participantCounts(id),
    draw: draw && {
      status: draw.status,
      seedHash: draw.seed_hash,
      poolHash: draw.pool_hash,
      poolSize: JSON.parse(draw.pool_json).length,
      numWinners: draw.num_winners,
      numBackups: draw.num_backups,
      committedAt: draw.committed_at,
      drawnAt: draw.drawn_at,
      seed: draw.status === "drawn" ? draw.seed : null,
    },
    aiAvailable: aiAvailable(),
  });
});

export const PATCH = handle(async (req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  if (!(await getContest(id))) throw new HttpError("Contest not found", 404);
  const body = (await req.json()) as { name?: string; rules?: ContestRules };
  if (body.name?.trim()) await run("UPDATE contests SET name = ? WHERE id = ?", body.name.trim(), id);
  if (body.rules) {
    await run("UPDATE contests SET rules_json = ? WHERE id = ?", JSON.stringify(body.rules), id);
    await audit(id, "rules_saved", body.rules);
  }
  return NextResponse.json({ ok: true, ruleErrors: body.rules ? validateRules(body.rules) : [] });
});

export const DELETE = handle(async (_req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  await batch([
    ...["comments", "followers", "participants", "overrides", "draws"].map((t) => stmt(`DELETE FROM ${t} WHERE contest_id = ?`, id)),
    stmt("DELETE FROM contests WHERE id = ?", id),
  ]);
  await audit(id, "contest_deleted");
  return NextResponse.json({ ok: true });
});
