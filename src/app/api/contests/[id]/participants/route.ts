import { NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import { finalStatusSql } from "@/lib/contests";
import { contestId, handle, type IdParams } from "@/lib/http";

const PAGE = 50;

export const GET = handle(async (req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const url = new URL(req.url);
  const userKey = url.searchParams.get("userKey");

  if (userKey) {
    const comments = userKey.startsWith("u:")
      ? await all("SELECT * FROM comments WHERE contest_id = ? AND lower(username) = ? AND user_id IS NULL ORDER BY timestamp", id, userKey.slice(2))
      : await all("SELECT * FROM comments WHERE contest_id = ? AND user_id = ? ORDER BY timestamp", id, userKey);
    return NextResponse.json({ comments });
  }

  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();
  const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));

  const where = ["p.contest_id = ?"];
  const args: (string | number)[] = [id];
  if (status && status !== "all") {
    where.push(`${finalStatusSql()} = ?`);
    args.push(status);
  }
  if (q) {
    where.push("(p.username LIKE ? OR c.text LIKE ?)");
    args.push(`%${q.replace(/^@/, "")}%`, `%${q}%`);
  }
  const from = `FROM participants p
    LEFT JOIN overrides o ON o.contest_id = p.contest_id AND o.user_key = p.user_key
    LEFT JOIN comments c ON c.contest_id = p.contest_id AND c.id = p.comment_id
    WHERE ${where.join(" AND ")}`;

  const total = (await get<{ n: number }>(`SELECT COUNT(*) AS n ${from}`, ...args))!.n;
  const rows = await all(
      `SELECT p.user_key AS userKey, p.username, p.auto_status AS autoStatus, ${finalStatusSql()} AS status,
        o.status AS override, o.note AS overrideNote, p.comment_count AS commentCount, p.reasons_json AS reasons,
        c.id AS commentId, c.text, c.timestamp, c.eval_json AS evalJson, c.parent_id AS parentId
       ${from}
       ORDER BY CASE ${finalStatusSql()} WHEN 'review' THEN 0 WHEN 'eligible' THEN 1 ELSE 2 END, p.username
       LIMIT ? OFFSET ?`,
      ...args,
      PAGE,
      page * PAGE,
  );
  return NextResponse.json({ total, page, pageSize: PAGE, rows });
});
