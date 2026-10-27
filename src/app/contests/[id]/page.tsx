"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Avatar, Button, PillTabs } from "@/components/ui";
import { api } from "@/lib/client";
import type { Detail } from "@/components/contest/types";
import SetupTab from "@/components/contest/SetupTab";
import RulesTab from "@/components/contest/RulesTab";
import EntriesTab from "@/components/contest/EntriesTab";
import DrawTab from "@/components/contest/DrawTab";
import { ScoreTile } from "@/components/graphics";

type Tab = "setup" | "rules" | "entries" | "draw";

const TAB_KEYS: Tab[] = ["setup", "rules", "entries", "draw"];

export default function ContestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = use(params);
  const initialTab = use(searchParams).tab as Tab | undefined;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>(initialTab && TAB_KEYS.includes(initialTab) ? initialTab : "setup");
  const [justPicked, setJustPicked] = useState(false);
  const revealed = useCallback(() => setJustPicked(false), []);
  const router = useRouter();
  const setTab = (t: Tab) => {
    setTabState(t);
    router.replace(`?tab=${t}`, { scroll: false });
  };

  const reload = useCallback(async () => {
    try {
      setDetail(await api<Detail>(`/api/contests/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    api<Detail>(`/api/contests/${id}`).then(setDetail, (e: Error) => setError(e.message));
  }, [id]);

  // Drive the fetch: each call to /fetch/step works for ~40s on the server, then we call again.
  // The server holds a lease, so a second open tab just gets "busy" and waits.
  useEffect(() => {
    if (detail?.fetch.status !== "running") return;
    let stop = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      let failures = 0;
      while (!stop) {
        let r: { state: string; retryAfterMs?: number };
        try {
          r = await api(`/api/contests/${id}/fetch/step`, { method: "POST" });
          failures = 0;
        } catch {
          if (++failures >= 5) break;
          await sleep(5000);
          continue;
        }
        if (stop) break;
        await reload();
        if (r.state === "waiting") await sleep(r.retryAfterMs ?? 60_000);
        else if (r.state === "busy") await sleep(5000);
        else if (r.state !== "more") break;
      }
    })();
    return () => {
      stop = true;
    };
  }, [detail?.fetch.status, id, reload]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!detail)
    return (
      <div className="space-y-4">
        <div className="h-16 w-72 animate-pulse rounded-2xl bg-white/15" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/10" />
      </div>
    );

  async function remove() {
    if (!confirm(`Delete "${detail!.contest.name}" and all its data?`)) return;
    await api(`/api/contests/${id}`, { method: "DELETE" });
    router.push("/");
  }

  const { counts, contest } = detail;
  const step = (n: number, label: string, done: boolean) => (
    <span className="flex items-center gap-2">
      <span className={done ? "grid h-5 w-5 place-items-center rounded-full bg-ok text-[11px] text-white" : "grid h-5 w-5 place-items-center rounded-full bg-current/15 text-[11px]"}>
        {done ? "✓" : n}
      </span>
      {label}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="animate-rise flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {contest.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contest.thumbnailUrl} alt="" className="h-20 w-20 rounded-2xl object-cover shadow-glow ring-2 ring-kbfc-yellow" />
          ) : (
            <Avatar name={contest.name} size={64} />
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kbfc-yellow">Contest</p>
            <h1 className="font-display text-5xl leading-none">{contest.name}</h1>
            <p className="text-sm text-white/70">
              @{contest.hostUsername} ·{" "}
              <a href={contest.permalink ?? contest.postUrl} target="_blank" rel="noreferrer" className="underline decoration-white/40 underline-offset-2 hover:text-white">
                open post ↗
              </a>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 rounded-2xl bg-black/30 p-1.5 ring-1 ring-kbfc-yellow/30">
            <ScoreTile label="Comments" value={detail.stats.total.toLocaleString()} tone="yellow" />
            <ScoreTile label="Eligible" value={counts.eligible.toLocaleString()} tone="green" />
            <ScoreTile label="Review" value={counts.review.toLocaleString()} tone="amber" />
            <ScoreTile label="Rejected" value={counts.rejected.toLocaleString()} tone="red" />
          </div>
          <Button variant="ghost" onClick={remove}>Delete</Button>
        </div>
      </div>

      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { key: "setup", label: step(1, "Get comments", detail.fetch.status === "done" && detail.stats.total > 0) },
          { key: "rules", label: step(2, "Rules & pick", detail.draw?.status === "drawn") },
          { key: "draw", label: step(3, "Winners", detail.draw?.status === "drawn") },
          { key: "entries", label: step(4, "All entries", Boolean(contest.evaluatedAt) && counts.review === 0) },
        ]}
      />

      {tab === "setup" && <SetupTab detail={detail} reload={reload} onNext={() => setTab("rules")} />}
      {tab === "rules" && (
        <RulesTab
          detail={detail}
          reload={reload}
          onRan={() => setTab("entries")}
          onPicked={() => {
            setJustPicked(true);
            setTab("draw");
          }}
        />
      )}
      {tab === "entries" && <EntriesTab detail={detail} reload={reload} />}
      {tab === "draw" && <DrawTab detail={detail} reload={reload} autoReveal={justPicked} onRevealed={revealed} />}
    </div>
  );
}
