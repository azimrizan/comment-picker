import { NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import { activeDraw, commitDraw, resetDraw, runDraw, type PoolEntry } from "@/lib/draw";
import { contestId, handle, HttpError, type IdParams } from "@/lib/http";

function enrich(contestId: number, list: PoolEntry[]) {
  return Promise.all(
    list.map(async (e) => ({
      ...e,
      ...((await get(
        `SELECT c.text, c.timestamp FROM participants p JOIN comments c ON c.contest_id = p.contest_id AND c.id = p.comment_id
         WHERE p.contest_id = ? AND p.user_key = ?`,
        contestId,
        e.userKey,
      )) ?? {}),
    })),
  );
}

export const GET = handle(async (_req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const d = await activeDraw(id);
  const result = d?.result_json ? (JSON.parse(d.result_json) as { winners: PoolEntry[]; backups: PoolEntry[] }) : null;
  const history = await all(
    "SELECT id, status, committed_at, drawn_at, num_winners, num_backups, result_json FROM draws WHERE contest_id = ? ORDER BY id DESC",
    id,
  );
  // A random sample of entrant names for the spinning reveal animation (display only).
  const pool = d ? (JSON.parse(d.pool_json) as PoolEntry[]) : [];
  const poolSample = [...pool].sort(() => Math.random() - 0.5).slice(0, 300).map((p) => p.username);
  return NextResponse.json({
    poolSample,
    winners: result ? await enrich(id, result.winners) : [],
    backups: result ? await enrich(id, result.backups) : [],
    history,
  });
});

export const POST = handle(async (req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const body = (await req.json()) as { action: string; winners?: number; backups?: number };
  try {
    if (body.action === "commit") await commitDraw(id, Number(body.winners), Number(body.backups ?? 0));
    else if (body.action === "draw") await runDraw(id);
    else if (body.action === "reset") await resetDraw(id);
    else throw new Error("Unknown action");
  } catch (e) {
    throw new HttpError((e as Error).message);
  }
  return NextResponse.json({ ok: true });
});
