"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Avatar, Badge, Button, Card, Field, Input, StatusIcon } from "@/components/ui";
import { Football, Pitch, Trophy } from "@/components/graphics";
import { api, fmtTime } from "@/lib/client";

interface ContestItem {
  id: number;
  name: string;
  permalink: string | null;
  thumbnail_url: string | null;
  created_at: string;
  fetch_status: string;
  api_comments_count: number | null;
  comment_count: number;
  drawn: number;
}

function ContestRow({ c, i }: { c: ContestItem; i: number }) {
  return (
    <Link
      href={`/contests/${c.id}`}
      style={{ animationDelay: `${i * 60}ms` }}
      className="animate-rise group flex items-center gap-3.5 rounded-2xl border-l-4 border-kbfc-yellow bg-white p-3.5 text-slate-800 shadow-card transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      {c.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.thumbnail_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-kbfc-yellow" />
      ) : (
        <Avatar name={c.name} size={48} />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{c.name}</div>
        <div className="truncate text-sm text-slate-500">
          {c.comment_count.toLocaleString()} comments · {fmtTime(c.created_at)}
        </div>
      </div>
      {c.drawn ? (
        <span className="flex items-center gap-2 text-xs font-semibold text-green-700">
          Winners drawn <StatusIcon status="pass" size={26} />
        </span>
      ) : (
        <Badge status={c.fetch_status}>{c.fetch_status === "idle" ? "new" : c.fetch_status}</Badge>
      )}
    </Link>
  );
}

export default function Home() {
  const [contests, setContests] = useState<ContestItem[] | null>(null);
  const [name, setName] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    api<{ contests: ContestItem[] }>("/api/contests").then(
      (r) => setContests(r.contests),
      (e: Error) => setError(e.message),
    );
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: number }>("/api/contests", { method: "POST", json: { name, postUrl } });
      router.push(`/contests/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="relative grid items-center gap-8 md:grid-cols-[1.15fr_1fr]">
        <div className="animate-rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-kbfc-yellow/15 px-3 py-1 text-xs font-semibold text-kbfc-yellow ring-1 ring-kbfc-yellow/40">
            <span className="h-2 w-2 animate-pulse rounded-full bg-kbfc-yellow" /> Official Instagram API · provably fair draws
          </p>
          <h1 className="font-display text-6xl leading-[0.92] sm:text-7xl">
            Pick the winners
            <br />
            the <span className="shimmer-text">KBFC</span> trusts
          </h1>
          <div className="mt-6 flex items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/kbfc.png" alt="Kerala Blasters FC" className="h-24 w-auto drop-shadow-[0_8px_16px_rgb(0_0_0/0.35)]" />
            <span className="font-display text-4xl text-kbfc-yellow" aria-label="in partnership with">×</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/ofioh-sporty.png" alt="Ofioh Sporty" className="h-16 w-auto" />
          </div>
          <ul className="mt-6 flex flex-wrap gap-2 text-sm font-medium">
            {["Every comment checked", "Score predictions read", "Verifiable draw"].map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <StatusIcon status="pass" size={18} /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise relative hidden md:block" style={{ animationDelay: "120ms" }} aria-hidden>
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 shadow-card ring-4 ring-kbfc-yellow/80">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.06)_0_40px,transparent_40px_80px)]" />
            <Pitch className="relative w-full text-white/45" />
            <div className="absolute left-1/2 top-[38%] -translate-x-1/2">
              <Football className="animate-bounce-ball h-16 w-16 drop-shadow-[0_14px_10px_rgb(0_0_0/0.35)]" />
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="max-w-[70%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-left text-slate-800 shadow-card">
                <p className="text-xs font-semibold text-brand-600">@yellow.army.fan · example</p>
                <p className="text-sm">KBFC 2-1 ⚽ <span className="font-semibold text-brand-600">@friend1 @friend2</span></p>
              </div>
              <Trophy className="h-20 w-20 drop-shadow-[0_10px_14px_rgb(0_0_0/0.4)]" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 md:grid-cols-[1fr_380px]">
        <section className="glass animate-rise rounded-3xl p-3">
          <h2 className="font-display px-2 pb-3 pt-1 text-2xl">Your contests</h2>
          {!contests ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-white/20" />)}
            </div>
          ) : contests.length === 0 ? (
            <div className="rounded-2xl bg-white/10 px-6 py-12 text-center">
              <Football className="animate-bounce-ball mx-auto h-14 w-14" />
              <p className="mt-2 font-semibold">No contests yet</p>
              <p className="text-sm text-white/70">Create your first one with the post or reel URL →</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contests.map((c, i) => <ContestRow key={c.id} c={c} i={i} />)}
            </div>
          )}
        </section>

        <Card title="Start a new contest">
          <form onSubmit={create} className="space-y-4">
            <Field label="Contest name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="KBFC vs BFC – Predict & Win" />
            </Field>
            <Field label="Post / reel URL" hint="Must be on the Instagram account connected in Settings.">
              <Input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" />
            </Field>
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" loading={busy} disabled={!name || !postUrl} className="w-full py-3">
              {busy ? "Finding your post…" : "Create contest →"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
