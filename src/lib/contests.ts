import { all, get } from "./db";
import type { ContestRules, ParticipantStatus } from "./rules/types";

export interface ContestRow {
  id: number;
  name: string;
  post_url: string;
  media_id: string;
  permalink: string | null;
  caption: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  media_timestamp: string | null;
  api_comments_count: number | null;
  host_username: string | null;
  rules_json: string;
  fetch_status: "idle" | "running" | "done" | "error";
  fetch_lease: string | null;
  fetch_run: number;
  fetch_cursor: string | null;
  fetch_fetched: number;
  fetch_note: string | null;
  fetch_error: string | null;
  fetch_started_at: string | null;
  fetch_finished_at: string | null;
  evaluated_at: string | null;
  created_at: string;
}

export function getContest(id: number) {
  return get<ContestRow>("SELECT * FROM contests WHERE id = ?", id);
}

export function contestRules(c: ContestRow): ContestRules {
  return JSON.parse(c.rules_json) as ContestRules;
}

export function listContests() {
  return all(
      `SELECT c.id, c.name, c.permalink, c.thumbnail_url, c.created_at, c.fetch_status, c.api_comments_count,
        (SELECT COUNT(*) FROM comments WHERE contest_id = c.id) AS comment_count,
        (SELECT COUNT(*) FROM draws WHERE contest_id = c.id AND status = 'drawn') AS drawn
       FROM contests c ORDER BY c.id DESC`,
  );
}

export interface FollowerList {
  set: Set<string>;
  count: number;
  uploadedAt: string;
  sourceFiles: string[];
}

export async function getFollowers(contestId: number): Promise<FollowerList | null> {
  const row = await get<{ usernames: string; count: number; uploaded_at: string; source_files: string }>(
    "SELECT * FROM followers WHERE contest_id = ?",
    contestId,
  );
  if (!row) return null;
  return {
    set: new Set(row.usernames ? row.usernames.split("\n") : []),
    count: row.count,
    uploadedAt: row.uploaded_at,
    sourceFiles: JSON.parse(row.source_files),
  };
}

export function finalStatusSql() {
  return "COALESCE(o.status, p.auto_status)";
}

export async function participantCounts(contestId: number) {
  const rows = await all<{ status: ParticipantStatus; n: number }>(
    `SELECT ${finalStatusSql()} AS status, COUNT(*) AS n FROM participants p
     LEFT JOIN overrides o ON o.contest_id = p.contest_id AND o.user_key = p.user_key
     WHERE p.contest_id = ? GROUP BY 1`,
    contestId,
  );
  const out = { eligible: 0, review: 0, rejected: 0, total: 0, overridden: 0 };
  for (const r of rows) {
    out[r.status] = r.n;
    out.total += r.n;
  }
  out.overridden = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM overrides WHERE contest_id = ?", contestId))!.n;
  return out;
}
