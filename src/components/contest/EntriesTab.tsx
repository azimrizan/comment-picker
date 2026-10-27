"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Avatar, Badge, Button, cx, Input, PillTabs, Stat, StatusIcon, toast } from "@/components/ui";
import { api, fmtTime } from "@/lib/client";
import type { RuleResult } from "@/lib/rules/types";
import type { TabProps } from "./types";

interface Row {
  userKey: string;
  username: string;
  autoStatus: string;
  status: string;
  override: string | null;
  overrideNote: string | null;
  commentCount: number;
  reasons: string;
  commentId: string;
  text: string;
  timestamp: string;
  evalJson: string | null;
  parentId: string | null;
}

interface UserComment {
  id: string;
  text: string;
  timestamp: string;
  parent_id: string | null;
  deleted: number;
  hidden: number;
  eval_status: string | null;
  eval_json: string | null;
}

type Filter = "review" | "eligible" | "rejected" | "all";

function RuleList({ json }: { json: string | null }) {
  if (!json) return <p className="text-xs text-slate-500">Not checked (reply or our own comment).</p>;
  const results = JSON.parse(json) as RuleResult[];
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {results.map((r, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
          <StatusIcon status={r.status} size={18} />
          <span className="pt-px">{r.reason}</span>
        </li>
      ))}
    </ul>
  );
}

function UserDetail({ contestId, userKey }: { contestId: number; userKey: string }) {
  const [comments, setComments] = useState<UserComment[] | null>(null);
  useEffect(() => {
    api<{ comments: UserComment[] }>(`/api/contests/${contestId}/participants?userKey=${encodeURIComponent(userKey)}`).then((r) =>
      setComments(r.comments),
    );
  }, [contestId, userKey]);
  if (!comments) return <div className="h-16 animate-pulse rounded-xl bg-slate-100" />;
  return (
    <div className="space-y-2.5">
      {comments.map((c) => (
        <div key={c.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {fmtTime(c.timestamp)}
            {c.parent_id && <Badge status="idle">reply</Badge>}
            {c.deleted ? <Badge status="error">deleted</Badge> : null}
            {c.hidden ? <Badge status="interrupted">hidden</Badge> : null}
            {c.eval_status && c.eval_status !== "skipped" && <Badge status={c.eval_status} />}
          </div>
          <p className="mb-2.5 whitespace-pre-wrap break-words text-sm text-slate-800">{c.text}</p>
          <RuleList json={c.eval_json} />
        </div>
      ))}
    </div>
  );
}

function EntryCard({ contestId, r, i, open, onToggle, onOverride }: { contestId: number; r: Row; i: number; open: boolean; onToggle: () => void; onOverride: (s: "eligible" | "rejected" | null) => void }) {
  const reasons = JSON.parse(r.reasons) as string[];
  return (
    <div
      style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
      className={cx("animate-rise rounded-2xl bg-white text-slate-800 shadow-card transition", open && "ring-2 ring-brand-300")}
    >
      <div className="flex items-start gap-3.5 p-3.5">
        <Avatar name={r.username} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <a href={`https://instagram.com/${r.username}`} target="_blank" rel="noreferrer" className="font-semibold hover:text-brand-600">
              @{r.username}
            </a>
            {r.override && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700" title={r.overrideNote ?? ""}>
                decided by you
              </span>
            )}
            {r.commentCount > 1 && <span className="text-xs text-slate-400">{r.commentCount} comments</span>}
          </div>
          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-sm text-slate-500">{r.text}</p>
          {reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reasons.map((x, k) => (
                <span key={k} className={cx("rounded-lg px-2 py-0.5 text-xs font-medium", r.status === "review" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700")}>
                  {x}
                </span>
              ))}
            </div>
          )}
          {r.overrideNote && <p className="mt-1.5 text-xs italic text-slate-500">“{r.overrideNote}”</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {r.status !== "eligible" && (
              <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => onOverride("eligible")}>✓ Approve</Button>
            )}
            {r.status !== "rejected" && (
              <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => onOverride("rejected")}>✕ Reject</Button>
            )}
            {r.override && <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => onOverride(null)}>Undo</Button>}
            <button className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-800" onClick={onToggle}>
              {open ? "Hide details ▲" : "Details ▼"}
            </button>
          </div>
        </div>
        <StatusIcon status={r.status} size={30} />
      </div>
      {open && (
        <div className="border-t border-slate-100 p-3.5">
          <UserDetail contestId={contestId} userKey={r.userKey} />
        </div>
      )}
    </div>
  );
}

export default function EntriesTab({ detail, reload }: TabProps) {
  const id = detail.contest.id;
  const [filter, setFilter] = useState<Filter>(detail.counts.review ? "review" : "eligible");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; pageSize: number; rows: Row[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: filter, q, page: String(page) });
    setData(await api(`/api/contests/${id}/participants?${params}`));
  }, [id, filter, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function runChecks() {
    setBusy(true);
    setError(null);
    try {
      const s = await api<{ entries: number; aiRead: number; aiError: string | null; eligible: number; review: number; rejected: number }>(
        `/api/contests/${id}/check`,
        { method: "POST" },
      );
      if (s.aiError) toast("info", "AI fallback skipped", s.aiError);
      toast(
        "success",
        `Checked ${s.entries.toLocaleString()} comments${s.aiRead ? ` (${s.aiRead} read by AI)` : ""}`,
        `${s.eligible.toLocaleString()} eligible · ${s.review.toLocaleString()} need review · ${s.rejected.toLocaleString()} rejected`,
      );
      await Promise.all([reload(), load()]);
    } catch (e) {
      const err = e as Error & { errors?: string[] };
      setError(err.errors?.join(" ") ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  async function override(row: Row, status: "eligible" | "rejected" | null) {
    let note: string | null = null;
    if (status) {
      note = prompt(`Why mark @${row.username} as ${status}? (optional)`, "");
      if (note === null) return;
    }
    await api(`/api/contests/${id}/override`, { method: "POST", json: { userKey: row.userKey, status, note } });
    toast("success", status ? `@${row.username} ${status === "eligible" ? "approved" : "rejected"}` : `Back to automatic for @${row.username}`);
    await Promise.all([reload(), load()]);
  }

  const c = detail.counts;
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People" value={c.total.toLocaleString()} />
        <Stat label="Eligible" value={c.eligible.toLocaleString()} tone="green" icon={<StatusIcon status="pass" size={20} />} />
        <Stat label="Needs review" value={c.review.toLocaleString()} tone="amber" icon={<StatusIcon status="review" size={20} />} />
        <Stat label="Rejected" value={c.rejected.toLocaleString()} tone="red" icon={<StatusIcon status="fail" size={20} />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/75">
          {detail.contest.evaluatedAt ? (
            <>
              Last checked {fmtTime(detail.contest.evaluatedAt)}.{c.overridden > 0 && ` ${c.overridden} decision(s) by you are kept on re-check.`}
            </>
          ) : (
            "Entries haven't been checked yet - set the guidelines, then run the checks."
          )}
        </p>
        <div className="flex gap-2">
          <a href={`/api/contests/${id}/export?type=participants`}>
            <Button variant="glass">⬇ Export CSV</Button>
          </a>
          <Button loading={busy} disabled={detail.fetch.status === "running"} onClick={runChecks}>
            {busy ? "Checking…" : "↻ Run checks"}
          </Button>
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}

      <section className="glass rounded-3xl p-3">
        <div className="flex flex-col gap-3 px-1 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <PillTabs<Filter>
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(0);
            }}
            options={[
              { key: "review", label: `Needs review · ${c.review.toLocaleString()}` },
              { key: "eligible", label: `Eligible · ${c.eligible.toLocaleString()}` },
              { key: "rejected", label: `Rejected · ${c.rejected.toLocaleString()}` },
              { key: "all", label: "All" },
            ]}
          />
          <Input
            placeholder="🔍  Search username or comment…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="bg-white sm:max-w-xs"
          />
        </div>

        {!data ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/20" />)}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="rounded-2xl bg-white/10 px-6 py-14 text-center">
            <p className="text-3xl">{filter === "review" ? "🎉" : "🔎"}</p>
            <p className="mt-2 font-semibold">{filter === "review" ? "Nothing left to review" : "Nothing here"}</p>
            {filter === "review" && <p className="text-sm text-white/70">Every entry has a clear decision. Head to the draw!</p>}
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.rows.map((r, i) => (
              <EntryCard
                key={r.userKey}
                contestId={id}
                r={r}
                i={i}
                open={open === r.userKey}
                onToggle={() => setOpen(open === r.userKey ? null : r.userKey)}
                onOverride={(s) => override(r, s)}
              />
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between px-1 text-sm">
            <span className="text-white/75">
              {data!.total.toLocaleString()} people · page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="glass" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</Button>
              <Button variant="glass" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
