// Original matchday artwork in KBFC colours. Hand-drawn SVG - no club crests or logos.

import type { ReactNode } from "react";

// Local copy: ui.tsx is a client module, and these graphics also render in server components (the layout).
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Classic black-and-white football (truncated icosahedron look). */
export function Football({ className, spin }: { className?: string; spin?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cx(spin && "animate-roll", className)} aria-hidden>
      <defs>
        <radialGradient id="ball-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef1f6" />
          <stop offset="1" stopColor="#b9c2d3" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#ball-shade)" stroke="#0b1530" strokeWidth="2.5" />
      <g fill="#0b1530">
        <polygon points="50,31 64,41 59,57 41,57 36,41" />
        <polygon points="50,3.5 60,10 56,20 44,20 40,10" />
        <polygon points="93,38 95,52 86,58 77,49 81,38" />
        <polygon points="78,86 66,94 60,86 66,75 78,76" />
        <polygon points="22,86 34,94 40,86 34,75 22,76" />
        <polygon points="7,38 5,52 14,58 23,49 19,38" />
      </g>
      <g stroke="#0b1530" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M50 31V20M64 41l17-3M59 57l7 18M41 57l-7 18M36 41l-17-3" />
        <path d="M44 20 31 26 19 38M56 20l13 6 12 12M86 58l-6 12-2 6M14 58l6 12 2 6M40 86h20" />
      </g>
    </svg>
  );
}

/** Top-down half pitch in chalk lines, for backdrops. */
export function Pitch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="4" width="392" height="252" rx="6" />
      <line x1="200" y1="4" x2="200" y2="256" />
      <circle cx="200" cy="130" r="42" />
      <circle cx="200" cy="130" r="3" fill="currentColor" />
      <rect x="4" y="66" width="62" height="128" />
      <rect x="4" y="100" width="22" height="60" />
      <path d="M66 104a32 32 0 0 1 0 52" />
      <rect x="334" y="66" width="62" height="128" />
      <rect x="374" y="100" width="22" height="60" />
      <path d="M334 104a32 32 0 0 0 0 52" />
      <circle cx="46" cy="130" r="2.5" fill="currentColor" />
      <circle cx="354" cy="130" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function Trophy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="cup" x1="0" x2="1">
          <stop offset="0" stopColor="#fff3a3" />
          <stop offset="0.45" stopColor="#fed100" />
          <stop offset="1" stopColor="#c99a00" />
        </linearGradient>
      </defs>
      <path d="M18 8h28v12c0 9-6 16-14 16s-14-7-14-16V8z" fill="url(#cup)" />
      <path d="M18 12H9c0 9 4 14 11 15M46 12h9c0 9-4 14-11 15" stroke="#fed100" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M28 36h8v9h-8z" fill="#e0b400" />
      <rect x="19" y="45" width="26" height="6" rx="1.5" fill="url(#cup)" />
      <rect x="15" y="51" width="34" height="7" rx="2" fill="#003087" />
      <path d="M32 14l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/** Two stadium floodlight beams sweeping from the top corners. */
export function Floodlights({ className }: { className?: string }) {
  const beam = "absolute top-[-10%] h-[130%] w-[38%] origin-top bg-gradient-to-b from-kbfc-sun/25 via-kbfc-yellow/5 to-transparent blur-2xl";
  return (
    <div className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className={cx(beam, "animate-sweep left-[4%] [clip-path:polygon(45%_0,55%_0,100%_100%,0_100%)]")} />
      <div className={cx(beam, "animate-sweep right-[4%] [animation-delay:-3.5s] [clip-path:polygon(45%_0,55%_0,100%_100%,0_100%)]")} />
    </div>
  );
}

/** Stadium scoreboard tile: big LED-style number on navy. */
export function ScoreTile({ label, value, tone }: { label: string; value: ReactNode; tone: "green" | "amber" | "red" | "yellow" }) {
  const tones = { green: "text-emerald-300", amber: "text-amber-300", red: "text-rose-300", yellow: "text-kbfc-yellow" };
  return (
    <div className="flex min-w-24 flex-col items-center rounded-xl bg-kbfc-navy/80 px-4 py-2 ring-1 ring-white/10">
      <span className={cx("font-display text-3xl leading-none tabular-nums", tones[tone])}>{value}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">{label}</span>
    </div>
  );
}

const CHANTS = ["Manjappada", "Yellow Army", "Predict & Win", "#YellowThudarum", "Matchday", "Fair draw, every time"];

/** Scrolling stadium ad-board ticker. */
export function Ticker() {
  const row = [...CHANTS, ...CHANTS];
  return (
    <div className="relative overflow-hidden border-y border-kbfc-yellow/40 bg-kbfc-yellow text-brand-900" aria-hidden>
      <div className="animate-marquee flex w-max gap-8 whitespace-nowrap py-1.5 font-display text-lg">
        {[...row, ...row].map((c, i) => (
          <span key={i} className="flex items-center gap-8">
            {c}
            <Football className="h-4 w-4" />
          </span>
        ))}
      </div>
    </div>
  );
}
