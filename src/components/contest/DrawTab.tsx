"use client";

import { useEffect, useState } from "react";
import { Alert, Avatar, Button, Card, copyText, cx, Stat, StatusIcon, toast } from "@/components/ui";
import { api, fmtTime } from "@/lib/client";
import WinnerReveal, { medal, type Picked } from "./WinnerReveal";
import type { Detail, TabProps } from "./types";

interface DrawData {
  poolSample: string[];
  winners: Picked[];
  backups: Picked[];
}

function Counter({ label, value, onChange, min, hint }: { label: string; value: number; onChange: (v: number) => void; min: number; hint: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <button className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
          className="w-16 bg-transparent text-center text-3xl font-semibold tabular-nums text-slate-900 outline-none"
        />
        <button className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100" onClick={() => onChange(value + 1)}>+</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Fingerprint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <button onClick={() => copyText(value, `${label} copied`)} className="rounded-lg px-2 py-0.5 text-xs font-semibold text-brand-600 hover:bg-brand-50">Copy</button>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-slate-700">{value}</p>
    </div>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["Lock entries", "Publish fingerprints", "Draw & celebrate"];
  return (
    <div className="glass flex items-center gap-2 rounded-2xl p-2 text-sm font-semibold">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={s} className={cx("flex min-w-0 items-center gap-2", active ? "flex-1" : "sm:flex-1")}>
            <div className={cx("flex flex-1 items-center gap-2 rounded-xl px-3 py-2 transition", active ? "bg-kbfc-yellow text-brand-900 shadow-glow" : "text-white/75")}>
              <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs", done ? "bg-ok text-white" : active ? "bg-brand-600 text-white" : "bg-white/15")}>
                {done ? "✓" : n}
              </span>
              <span className={cx("truncate", !active && "hidden sm:inline")}>{s}</span>
            </div>
            {n < 3 && <span className="hidden text-white/40 sm:inline">→</span>}
          </div>
        );
      })}
      {current === 4 && <span className="whitespace-nowrap px-2 text-white/90 sm:hidden">All done 🎉</span>}
    </div>
  );
}

function announcementText(detail: Detail, winners: Picked[]) {
  const d = detail.draw!;
  return [
    `🏆 ${detail.contest.name} - WINNERS 🏆`,
    "",
    ...winners.map((w, i) => `${medal(i)} @${w.username}`),
    "",
    "Congratulations! 🎉 Please DM us within 24 hours to claim your prize.",
    `Thank you to all ${d.poolSize.toLocaleString()} fans who took part 💛`,
    "",
    `Fair draw · entries ${d.poolHash.slice(0, 12)}… · seed ${d.seed?.slice(0, 16)}…`,
  ].join("\n");
}

export default function DrawTab({ detail, reload, autoReveal, onRevealed }: TabProps & { autoReveal?: boolean; onRevealed?: () => void }) {
  const id = detail.contest.id;
  const d = detail.draw;
  const [winners, setWinners] = useState(3);
  const [backups, setBackups] = useState(2);
  const [data, setData] = useState<DrawData | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (d?.status !== "drawn") return;
    api<DrawData>(`/api/contests/${id}/draw`).then((r) => {
      setData(r);
      if (autoReveal) {
        setShowReveal(true);
        onRevealed?.();
      }
    });
  }, [id, d?.status, d?.drawnAt, autoReveal, onRevealed]);
  const result = d?.status === "drawn" ? data : null;

  async function act(action: "commit" | "draw" | "reset") {
    if (action === "reset" && d?.status === "drawn" && !confirm("Discard these winners and start a new draw? The old result stays in the audit log.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/contests/${id}/draw`, { method: "POST", json: { action, winners, backups } });
      if (action === "draw") {
        setData(await api<DrawData>(`/api/contests/${id}/draw`));
        setShowReveal(true);
      }
      if (action === "commit") toast("success", "Entries locked 🔒", "Post the fingerprints, then draw.");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const c = detail.counts;
  const step = !d ? 1 : d.status === "committed" ? 2 : 4;
  const storyText = d
    ? `🔒 ${detail.contest.name}: ${d.poolSize.toLocaleString()} eligible entries locked.\nEntries fingerprint: ${d.poolHash}\nSeed fingerprint: ${d.seedHash}\nWinners will be drawn from these - verifiable after the draw.`
    : "";

  return (
    <div className="space-y-5">
      <Steps current={step as 1 | 2 | 3 | 4} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="In the draw" value={c.eligible.toLocaleString()} tone="green" icon={<StatusIcon status="pass" size={20} />} />
        <Stat label="Needs review" value={c.review.toLocaleString()} tone="amber" icon={<StatusIcon status="review" size={20} />} />
        <Stat label="Rejected" value={c.rejected.toLocaleString()} tone="red" icon={<StatusIcon status="fail" size={20} />} />
      </div>
      {error && <Alert kind="error">{error}</Alert>}

      {!d && (
        <Card title="🔒 Lock the entries">
          {c.review > 0 && (
            <div className="mb-4">
              <Alert kind="warn">
                {c.review} entr{c.review === 1 ? "y needs" : "ies need"} review and <b>won&apos;t be in the draw</b> unless you approve them in the Entries tab.
              </Alert>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Counter label="Winners" value={winners} min={1} onChange={setWinners} hint="How many people win." />
            <Counter label="Backup winners" value={backups} min={0} onChange={setBackups} hint="Used in order if a winner doesn't respond." />
          </div>
          <p className="my-4 text-sm text-slate-600">
            Locking freezes the list of <b>{c.eligible.toLocaleString()}</b> eligible fans and creates a secret random seed. You&apos;ll get two
            fingerprints to post <i>before</i> drawing - proof nobody can change the result.
          </p>
          <Button loading={busy} disabled={c.eligible === 0} onClick={() => act("commit")} className="w-full py-3 sm:w-auto">
            🔒 Lock {c.eligible.toLocaleString()} entries
          </Button>
        </Card>
      )}

      {d?.status === "committed" && (
        <Card
          title="📣 Publish the fingerprints, then draw"
          actions={<Button variant="ghost" disabled={busy} onClick={() => act("reset")}>Unlock</Button>}
        >
          <p className="text-sm text-slate-600">
            {d.poolSize.toLocaleString()} fans locked in · {d.numWinners} winner{d.numWinners > 1 && "s"} + {d.numBackups} backup{d.numBackups !== 1 && "s"} ·{" "}
            {fmtTime(d.committedAt)}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Fingerprint label="Entries fingerprint" value={d.poolHash} />
            <Fingerprint label="Seed fingerprint" value={d.seedHash} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => copyText(storyText, "Story text copied")}>📋 Copy text for story</Button>
            <Button variant="gold" loading={busy} onClick={() => act("draw")} className="animate-glow px-7 py-3 text-base">
              🎲 Draw the winners!
            </Button>
          </div>
        </Card>
      )}

      {result && d && (
        <>
          <section className="glass animate-rise rounded-3xl p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3 pt-1">
              <h2 className="font-display text-3xl">🏆 Winners · drawn {fmtTime(d.drawnAt)}</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="glass" onClick={() => setShowReveal(true)}>▶ Replay reveal</Button>
                <Button variant="gold" onClick={() => copyText(announcementText(detail, result.winners), "Announcement copied")}>📋 Copy announcement</Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {result.winners.map((w, i) => (
                <div
                  key={w.userKey}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className={cx("animate-pop flex gap-3.5 rounded-2xl bg-white p-4 text-slate-800 shadow-card", i === 0 && "ring-4 ring-kbfc-yellow")}
                >
                  <Avatar name={w.username} size={52} ring={i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <a href={`https://instagram.com/${w.username}`} target="_blank" rel="noreferrer" className="truncate text-lg font-semibold hover:text-brand-600">
                        @{w.username}
                      </a>
                      <span className="text-2xl">{medal(i)}</span>
                    </div>
                    {w.text && <p className="mt-1 line-clamp-2 text-sm text-slate-500">“{w.text}”</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="text-slate-400">{fmtTime(w.timestamp)}</span>
                      <a href={`https://instagram.com/${w.username}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">Open profile ↗</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {result.backups.length > 0 && (
              <div className="mt-3 rounded-2xl bg-white/10 p-3">
                <p className="mb-2 px-1 text-sm font-semibold text-white/80">Backups (use in this order)</p>
                <div className="flex flex-wrap gap-2">
                  {result.backups.map((b, i) => (
                    <a key={b.userKey} href={`https://instagram.com/${b.username}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold text-slate-800 shadow-card hover:bg-slate-50">
                      <Avatar name={b.username} size={26} /> {i + 1}. @{b.username}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="✅ Before announcing">
              <ul className="space-y-2.5 text-sm text-slate-700">
                {[
                  "Open each winner's profile - still following, comment still there?",
                  "If a winner fails, use the backups in order. Don't redraw.",
                  "Post the announcement and DM the winners.",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5"><StatusIcon status="pass" size={20} /><span>{t}</span></li>
                ))}
              </ul>
            </Card>
            <Card
              title="🔐 Proof of fairness"
              actions={<Button variant="ghost" disabled={busy} onClick={() => act("reset")}>Redo draw</Button>}
            >
              <div className="space-y-2.5">
                <Fingerprint label="Seed (revealed)" value={d.seed ?? ""} />
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/contests/${id}/export?type=pool`}><Button variant="secondary" className="text-xs">⬇ Entries list</Button></a>
                  <a href={`/api/contests/${id}/export?type=winners`}><Button variant="secondary" className="text-xs">⬇ Winners CSV</Button></a>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => copyText(`node scripts/verify-draw.mjs ${d.seed} pool.txt ${d.numWinners} ${d.numBackups}`, "Verify command copied")}
                  >
                    📋 Verify command
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {showReveal && result && (
        <WinnerReveal
          contestName={detail.contest.name}
          winners={result.winners}
          backups={result.backups}
          pool={result.poolSample}
          announcement={announcementText(detail, result.winners)}
          onClose={() => setShowReveal(false)}
        />
      )}
    </div>
  );
}
