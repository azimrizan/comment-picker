import { NextResponse } from "next/server";
import { audit, nowIso, run } from "@/lib/db";
import { contestId, handle, HttpError, type IdParams } from "@/lib/http";

export const POST = handle(async (req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const { userKey, status, note } = (await req.json()) as { userKey: string; status: string | null; note?: string };
  if (!userKey) throw new HttpError("userKey required");
  if (status === null) {
    await run("DELETE FROM overrides WHERE contest_id = ? AND user_key = ?", id, userKey);
  } else {
    if (!["eligible", "rejected"].includes(status)) throw new HttpError("status must be eligible or rejected");
    await run(
      `INSERT INTO overrides (contest_id, user_key, status, note, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(contest_id, user_key) DO UPDATE SET status = excluded.status, note = excluded.note, created_at = excluded.created_at`,
      id,
      userKey,
      status,
      note ?? null,
      nowIso(),
    );
  }
  await audit(id, "override", { userKey, status, note });
  return NextResponse.json({ ok: true });
});
