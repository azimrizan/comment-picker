import { NextResponse } from "next/server";
import { audit, nowIso, run } from "@/lib/db";
import { contestId, handle, HttpError, type IdParams } from "@/lib/http";

const USERNAME = /^[a-z0-9._]{1,30}$/;

// The browser parses Instagram's export files and sends only the usernames,
// which keeps uploads far below the hosting platform's request size limit.
export const POST = handle(async (req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const { usernames, files } = (await req.json()) as { usernames?: string[]; files?: string[] };
  const set = new Set((usernames ?? []).map((u) => String(u).toLowerCase()).filter((u) => USERNAME.test(u)));
  if (!set.size) throw new HttpError("No usernames found in those files. Upload followers_1.json from the Instagram export.");

  const names = (files ?? []).map(String);
  await run(
    `INSERT INTO followers (contest_id, usernames, count, source_files, uploaded_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(contest_id) DO UPDATE SET usernames = excluded.usernames, count = excluded.count,
       source_files = excluded.source_files, uploaded_at = excluded.uploaded_at`,
    id,
    [...set].join("\n"),
    set.size,
    JSON.stringify(names),
    nowIso(),
  );
  await audit(id, "followers_uploaded", { count: set.size, files: names });
  return NextResponse.json({ count: set.size });
});

export const DELETE = handle(async (_req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  await run("DELETE FROM followers WHERE contest_id = ?", id);
  await audit(id, "followers_removed");
  return NextResponse.json({ ok: true });
});
