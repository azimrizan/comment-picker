import { auditStmt, batch, get, nowIso, run, stmt, audit } from "./db";
import { COMMENT_FIELD_SETS, getMedia, igGet, IgError, isRateLimit, type IgComment, type Page } from "./instagram";
import { getContest } from "./contests";

// Serverless-friendly fetch: the browser calls fetchStep() repeatedly. Each step pulls comment pages
// for up to STEP_BUDGET_MS, saves the paging cursor, and returns - so no request outlives the platform's time limit.
// A short lease stops two open tabs from fetching the same contest at once.

const STEP_BUDGET_MS = 40_000;
const LEASE_MS = 90_000;

interface Row {
  id: string;
  parent_id: string | null;
  username: string;
  user_id: string | null;
  text: string;
  timestamp: string;
  like_count: number | null;
  hidden: number;
}

function toRow(c: IgComment, parentId: string | null): Row {
  return {
    id: c.id,
    parent_id: parentId,
    username: c.from?.username ?? c.username ?? "",
    user_id: c.from?.id ?? null,
    text: c.text ?? "",
    timestamp: c.timestamp,
    like_count: c.like_count ?? null,
    hidden: c.hidden ? 1 : 0,
  };
}

const UPSERT = `
  INSERT INTO comments (contest_id, id, parent_id, username, user_id, text, timestamp, like_count, hidden, deleted, last_seen_run)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  ON CONFLICT(contest_id, id) DO UPDATE SET
    parent_id=COALESCE(excluded.parent_id, comments.parent_id), username=excluded.username, user_id=COALESCE(excluded.user_id, comments.user_id),
    text=excluded.text, timestamp=excluded.timestamp, like_count=excluded.like_count, hidden=excluded.hidden,
    deleted=0, last_seen_run=excluded.last_seen_run`;

export async function startFetch(contestId: number, resume: boolean) {
  const contest = await getContest(contestId);
  if (!contest) throw new Error("Contest not found");
  if (contest.fetch_status === "running" && contest.fetch_lease && Date.parse(contest.fetch_lease) > Date.now()) {
    throw new Error("A fetch is already running for this contest.");
  }

  const canResume = resume && contest.fetch_cursor && contest.fetch_status !== "done";
  const runNo = canResume ? contest.fetch_run : contest.fetch_run + 1;

  // Refresh the post's details (and Instagram's own comment count) once per fetch.
  const media = canResume ? null : await getMedia(contest.media_id);
  await batch([
    stmt(
      `UPDATE contests SET fetch_status='running', fetch_run=?, fetch_error=NULL, fetch_note=NULL, fetch_lease=NULL,
       fetch_started_at=?, fetch_finished_at=NULL ${canResume ? "" : ", fetch_fetched=0, fetch_cursor=NULL"} WHERE id=?`,
      runNo,
      nowIso(),
      contestId,
    ),
    ...(media
      ? [
          stmt(
            "UPDATE contests SET api_comments_count=?, caption=?, permalink=?, thumbnail_url=? WHERE id=?",
            media.comments_count ?? null,
            media.caption ?? null,
            media.permalink ?? null,
            media.thumbnail_url ?? media.media_url ?? null,
            contestId,
          ),
        ]
      : []),
    auditStmt(contestId, canResume ? "fetch_resumed" : "fetch_started", { run: runNo }),
  ]);
}

export type StepResult =
  | { state: "more" | "done" | "busy" | "idle"; fetched: number }
  | { state: "waiting"; fetched: number; retryAfterMs: number }
  | { state: "error"; fetched: number; error: string };

export async function fetchStep(contestId: number): Promise<StepResult> {
  const started = Date.now();
  const contest = await getContest(contestId);
  if (!contest) throw new Error("Contest not found");
  if (contest.fetch_status !== "running") return { state: "idle", fetched: contest.fetch_fetched };

  const lease = await run(
    "UPDATE contests SET fetch_lease=? WHERE id=? AND fetch_status='running' AND (fetch_lease IS NULL OR fetch_lease < ?)",
    new Date(started + LEASE_MS).toISOString(),
    contestId,
    nowIso(),
  );
  if (!lease.changes) return { state: "busy", fetched: contest.fetch_fetched };

  const note = (msg: string | null) => void run("UPDATE contests SET fetch_note=? WHERE id=?", msg, contestId).catch(() => {});
  let fetched = contest.fetch_fetched;
  let next = contest.fetch_cursor;
  let fieldSet = 0;

  try {
    for (;;) {
      let page: Page<IgComment>;
      try {
        page = next
          ? await igGet<Page<IgComment>>(next, {}, note, 20_000)
          : await igGet<Page<IgComment>>(`${contest.media_id}/comments`, { fields: COMMENT_FIELD_SETS[fieldSet], limit: "50" }, note, 20_000);
      } catch (e) {
        // Some API setups reject optional fields - retry the first page with the minimal field set.
        if (e instanceof IgError && e.code === 100 && !next && fieldSet < COMMENT_FIELD_SETS.length - 1) {
          fieldSet += 1;
          continue;
        }
        throw e;
      }

      const rows: Row[] = [];
      for (const c of page.data) {
        rows.push(toRow(c, null));
        let replies = c.replies;
        while (replies) {
          for (const r of replies.data) rows.push(toRow(r, c.id));
          replies = replies.paging?.next ? await igGet<Page<IgComment>>(replies.paging.next, {}, note, 20_000) : undefined;
        }
      }

      next = page.paging?.next ?? null;
      await batch([
        ...rows.map((r) =>
          stmt(UPSERT, contestId, r.id, r.parent_id, r.username, r.user_id, r.text, r.timestamp, r.like_count, r.hidden, contest.fetch_run),
        ),
        // Instagram lists some replies both on their own and under their parent, so count unique comments seen this run.
        stmt(
          "UPDATE contests SET fetch_fetched = (SELECT COUNT(*) FROM comments WHERE contest_id=? AND last_seen_run=?), fetch_cursor=? WHERE id=?",
          contestId,
          contest.fetch_run,
          next,
          contestId,
        ),
      ]);
      fetched = (await get<{ n: number }>("SELECT fetch_fetched AS n FROM contests WHERE id=?", contestId))!.n;
      if (!next) break;
      if (Date.now() - started > STEP_BUDGET_MS) {
        await run("UPDATE contests SET fetch_lease=NULL WHERE id=?", contestId);
        return { state: "more", fetched };
      }
    }

    if (fetched === 0 && (contest.api_comments_count ?? 0) > 0) {
      // Meta answers with empty pages (not an error) when the app isn't allowed to read other people's comments.
      throw new Error(
        `Instagram says this post has ${contest.api_comments_count} comments but returned none of them. ` +
          "This happens while the Meta app is in Development mode: switch it to Live in the Meta dashboard (Publish), then fetch again.",
      );
    }

    const gone = await get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM comments WHERE contest_id=? AND last_seen_run < ? AND deleted=0",
      contestId,
      contest.fetch_run,
    );
    await batch([
      stmt("UPDATE comments SET deleted=1 WHERE contest_id=? AND last_seen_run < ? AND deleted=0", contestId, contest.fetch_run),
      stmt(
        "UPDATE contests SET fetch_status='done', fetch_cursor=NULL, fetch_note=NULL, fetch_lease=NULL, fetch_finished_at=? WHERE id=?",
        nowIso(),
        contestId,
      ),
      auditStmt(contestId, "fetch_done", { run: contest.fetch_run, markedDeleted: gone?.n ?? 0 }),
    ]);
    return { state: "done", fetched };
  } catch (e) {
    if (isRateLimit(e)) {
      const secs = Math.round(e.retryAfterMs! / 1000);
      await run("UPDATE contests SET fetch_lease=NULL, fetch_note=? WHERE id=?", `Instagram rate limit - continuing in ${secs}s…`, contestId);
      return { state: "waiting", fetched, retryAfterMs: e.retryAfterMs! };
    }
    const msg = e instanceof Error ? e.message : String(e);
    await run("UPDATE contests SET fetch_status='error', fetch_error=?, fetch_note=NULL, fetch_lease=NULL WHERE id=?", msg, contestId);
    await audit(contestId, "fetch_error", { run: contest.fetch_run, error: msg });
    return { state: "error", fetched, error: msg };
  }
}
