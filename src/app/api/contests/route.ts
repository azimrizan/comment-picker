import { NextResponse } from "next/server";
import { audit, nowIso, run } from "@/lib/db";
import { listContests } from "@/lib/contests";
import { handle, HttpError } from "@/lib/http";
import { getAccount, resolveMedia } from "@/lib/instagram";
import { defaultContestRules } from "@/lib/rules/types";

export const GET = handle(async () => NextResponse.json({ contests: await listContests() }));

export const POST = handle(async (req: Request) => {
  const { name, postUrl } = (await req.json()) as { name?: string; postUrl?: string };
  if (!name?.trim()) throw new HttpError("Give the contest a name.");
  if (!postUrl?.trim()) throw new HttpError("Paste the post or reel URL.");

  const [account, media] = await Promise.all([getAccount(), resolveMedia(postUrl)]);
  const info = await run(
      `INSERT INTO contests (name, post_url, media_id, permalink, caption, media_type, thumbnail_url, media_timestamp,
        api_comments_count, host_username, rules_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name.trim(),
      postUrl.trim(),
      media.id,
      media.permalink ?? null,
      media.caption ?? null,
      media.media_type ?? null,
      media.thumbnail_url ?? media.media_url ?? null,
      media.timestamp ?? null,
      media.comments_count ?? null,
      account.username,
      JSON.stringify(defaultContestRules()),
      nowIso(),
  );
  const id = info.lastId;
  await audit(id, "contest_created", { name, mediaId: media.id });
  return NextResponse.json({ id });
});
