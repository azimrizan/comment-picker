import { all } from "@/lib/db";
import { finalStatusSql, getContest } from "@/lib/contests";
import { activeDraw, type PoolEntry } from "@/lib/draw";
import { contestId, handle, HttpError, type IdParams } from "@/lib/http";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

function file(body: string, name: string, type = "text/csv") {
  return new Response(body, {
    headers: { "content-type": `${type}; charset=utf-8`, "content-disposition": `attachment; filename="${name}"` },
  });
}

export const GET = handle(async (req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const c = await getContest(id);
  if (!c) throw new HttpError("Contest not found", 404);
  const type = new URL(req.url).searchParams.get("type");
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (type === "participants") {
    const rows = await all(
        `SELECT p.username, ${finalStatusSql()} AS status, p.auto_status, o.status AS override, o.note, p.comment_count,
          p.reasons_json, c.timestamp, c.text
         FROM participants p
         LEFT JOIN overrides o ON o.contest_id = p.contest_id AND o.user_key = p.user_key
         LEFT JOIN comments c ON c.contest_id = p.contest_id AND c.id = p.comment_id
         WHERE p.contest_id = ? ORDER BY 2, 1`,
        id,
    );
    const body = csv([
      ["username", "final_status", "auto_status", "override", "override_note", "comments", "reasons", "comment_time", "comment"],
      ...rows.map((r) => [
        r.username, r.status, r.auto_status, r.override, r.note, r.comment_count,
        (JSON.parse(String(r.reasons_json)) as string[]).join(" | "), r.timestamp, r.text,
      ]),
    ]);
    return file(body, `${slug}-participants.csv`);
  }

  const d = await activeDraw(id);
  if (!d) throw new HttpError("No draw yet.");
  if (type === "pool") {
    const pool = JSON.parse(d.pool_json) as PoolEntry[];
    return file(pool.map((p) => `${p.userKey}:${p.username}`).join("\n"), `${slug}-pool.txt`, "text/plain");
  }
  if (type === "winners") {
    if (!d.result_json) throw new HttpError("Draw not run yet.");
    const r = JSON.parse(d.result_json) as { winners: PoolEntry[]; backups: PoolEntry[] };
    const body = csv([
      ["position", "type", "username", "profile"],
      ...r.winners.map((w, i) => [i + 1, "winner", w.username, `https://instagram.com/${w.username}`]),
      ...r.backups.map((w, i) => [i + 1, "backup", w.username, `https://instagram.com/${w.username}`]),
    ]);
    return file(body + `\n\nseed,${d.seed}\nseed_sha256,${d.seed_hash}\npool_sha256,${d.pool_hash}\n`, `${slug}-winners.csv`);
  }
  throw new HttpError("type must be participants, pool or winners");
});
