"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, copyText, cx } from "@/components/ui";
import { Floodlights, Football, Pitch, Trophy } from "@/components/graphics";

export interface Picked {
  userKey: string;
  username: string;
  text?: string;
  timestamp?: string;
}

const COLORS = ["#fed100", "#f7ea48", "#003087", "#ffffff", "#1a4aa3", "#fed100"];
export const medal = (i: number) => (i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`);

function burst() {
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 100 };
  confetti({ ...base, particleCount: 140, spread: 90, startVelocity: 45, origin: { y: 0.55 } });
  confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } });
}

function rain(ms: number) {
  const end = Date.now() + ms;
  const frame = () => {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors: COLORS, disableForReducedMotion: true, zIndex: 100 });
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: COLORS, disableForReducedMotion: true, zIndex: 100 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export default function WinnerReveal({
  contestName,
  winners,
  backups,
  pool,
  announcement,
  onClose,
}: {
  contestName: string;
  winners: Picked[];
  backups: Picked[];
  pool: string[];
  announcement: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"spin" | "land" | "final">("spin");
  const [shown, setShown] = useState(pool[0] ?? winners[0]?.username ?? "");
  const [tick, setTick] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const finish = useCallback(() => {
    clearTimers();
    setIdx(winners.length);
    setPhase("final");
    burst();
    rain(2600);
  }, [winners.length]);

  // Slot-machine spin for winner #idx: names flick past, slowing down, then land.
  useEffect(() => {
    if (phase === "final" || idx >= winners.length) return;
    const names = pool.length > 3 ? pool : [...pool, ...winners.map((w) => w.username)];
    const stopAt = idx === 0 ? 420 : 300; // first winner gets the longest drumroll
    let delay = 40;
    let n = 0;
    const step = () => {
      if (delay > stopAt) {
        setShown(winners[idx].username);
        setTick((t) => t + 1);
        setPhase("land");
        burst();
        later(() => {
          if (idx + 1 >= winners.length) finish();
          else {
            setPhase("spin");
            setIdx(idx + 1);
          }
        }, 2200);
        return;
      }
      setShown(names[(n++ * 7 + idx * 13) % names.length]);
      setTick((t) => t + 1);
      delay *= 1.085;
      later(step, delay);
    };
    later(step, 350);
    return clearTimers;
  }, [idx, winners, pool, finish, phase === "final"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (phase === "final") onClose();
      else finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish, onClose]);

  const revealed = winners.slice(0, phase === "land" ? idx + 1 : idx);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-brand-700/95 via-brand-900/95 to-kbfc-navy/95 backdrop-blur-xl">
      <Floodlights />
      <Pitch className="pointer-events-none absolute bottom-[-12%] left-1/2 w-[140%] max-w-none -translate-x-1/2 text-white/[0.06]" />

      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
        {phase !== "final" ? (
          <>
            <button onClick={finish} className="absolute right-4 top-4 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/20">
              Skip ⏭
            </button>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-kbfc-yellow/80">{contestName}</p>
            {phase === "land" ? (
              <h2 className="font-display animate-pop mt-2 text-7xl sm:text-8xl">
                <span className="shimmer-text">Winner{winners.length > 1 ? ` #${idx + 1}` : ""}!</span>
              </h2>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-3">
                <Football spin className="h-16 w-16 drop-shadow-[0_10px_12px_rgb(0_0_0/0.4)]" />
                <h2 className="font-display text-5xl sm:text-6xl">
                  Drawing winner{winners.length > 1 && <> {idx + 1} of {winners.length}</>}…
                </h2>
              </div>
            )}

            <div className="mt-10 w-full max-w-md">
              <div key={phase === "land" ? `land-${idx}` : "spin"} className={cx(phase === "land" && "animate-pop")}>
              <div
                className={cx(
                  "relative overflow-hidden rounded-3xl bg-white p-6 text-slate-800 shadow-card",
                  phase === "land" ? "animate-glow ring-4 ring-kbfc-yellow" : "ring-1 ring-white/30",
                )}
              >
                <div className="flex items-center gap-4">
                  <span className={cx("rounded-full", phase === "land" && "animate-pulse-ring")}>
                    <Avatar name={shown} size={72} ring={phase === "land" ? "gold" : null} />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="h-10 overflow-hidden">
                      <p key={tick} className="animate-slot truncate text-3xl font-semibold tracking-tight">@{shown}</p>
                    </div>
                    <p className="text-sm text-slate-500">{phase === "land" ? "Congratulations! 🏆" : "Shuffling eligible Manjappada…"}</p>
                  </div>
                  {phase === "land" && <span className="animate-pop text-4xl">{medal(idx)}</span>}
                </div>
                {phase === "land" && winners[idx].text && (
                  <p className="animate-rise mt-4 rounded-2xl bg-slate-50 p-3 text-left text-sm text-slate-600" style={{ animationDelay: "250ms" }}>
                    “{winners[idx].text}”
                  </p>
                )}
              </div>
              </div>
            </div>

            {revealed.length > 0 && (
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {revealed.map((w, i) => (
                  <span key={w.userKey} className="animate-pop inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold text-slate-800 shadow-card">
                    <Avatar name={w.username} size={26} /> {medal(i)} @{w.username}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Trophy className="animate-pop h-32 w-32 drop-shadow-[0_20px_30px_rgb(254_209_0/0.45)]" />
            <h2 className="font-display animate-rise mt-2 text-7xl sm:text-8xl">
              <span className="shimmer-text">Congratulations!</span>
            </h2>
            <p className="animate-rise mt-2 text-white/70">{contestName}</p>

            <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
              {winners.map((w, i) => (
                <div
                  key={w.userKey}
                  style={{ animationDelay: `${150 + i * 120}ms` }}
                  className={cx(
                    "animate-pop flex items-center gap-3 rounded-2xl bg-white p-4 text-left text-slate-800 shadow-card",
                    winners.length % 2 === 1 && i === 0 && "sm:col-span-2",
                    i === 0 && "ring-4 ring-kbfc-yellow",
                  )}
                >
                  <Avatar name={w.username} size={52} ring={i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null} />
                  <div className="min-w-0 flex-1">
                    <a href={`https://instagram.com/${w.username}`} target="_blank" rel="noreferrer" className="block truncate text-lg font-semibold hover:text-brand-600">
                      @{w.username}
                    </a>
                    {w.text && <p className="truncate text-sm text-slate-500">“{w.text}”</p>}
                  </div>
                  <span className="text-3xl">{medal(i)}</span>
                </div>
              ))}
            </div>

            {backups.length > 0 && (
              <p className="animate-rise mt-5 text-sm text-white/70" style={{ animationDelay: "600ms" }}>
                Backups in order: {backups.map((b) => `@${b.username}`).join(" → ")}
              </p>
            )}

            <div className="animate-rise mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "700ms" }}>
              <Button variant="gold" className="px-6 py-3" onClick={() => copyText(announcement, "Announcement copied - paste it in your post or story")}>
                📋 Copy announcement
              </Button>
              <Button variant="glass" className="px-6 py-3" onClick={() => { burst(); rain(1500); }}>
                🎊 More confetti
              </Button>
              <Button variant="secondary" className="px-6 py-3" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
