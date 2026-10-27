"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Frosted glass panel holding a crisp white card - the look of the whole app. */
export function Card({
  title,
  children,
  actions,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("glass animate-rise rounded-3xl p-2", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5 pt-2">
          {title && <h2 className="font-display text-2xl text-white [&_span_span]:font-sans [&_span_span]:tracking-normal">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx("rounded-2xl bg-white p-5 text-slate-800 shadow-card", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost" | "gold" | "glass";
export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const styles: Record<Variant, string> = {
    primary:
      "bg-kbfc-yellow text-brand-900 shadow-[0_6px_18px_-6px_rgb(254_209_0/0.75)] hover:bg-kbfc-sun",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 shadow-sm",
    danger: "bg-red-500 text-white hover:bg-red-600",
    ghost: "text-current opacity-80 hover:opacity-100 hover:bg-current/10",
    gold: "bg-gradient-to-b from-kbfc-sun to-kbfc-yellow text-brand-900 shadow-[0_8px_26px_-6px_rgb(254_209_0/0.85)] hover:from-white hover:to-kbfc-sun",
    glass: "bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25",
  };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition outline-none focus-visible:ring-4 focus-visible:ring-kbfc-yellow/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        styles[variant],
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

const fieldCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldCls, props.className)} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const STATUS_STYLES: Record<string, string> = {
  eligible: "bg-green-50 text-green-700 ring-green-200",
  pass: "bg-green-50 text-green-700 ring-green-200",
  done: "bg-green-50 text-green-700 ring-green-200",
  drawn: "bg-green-50 text-green-700 ring-green-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  fail: "bg-red-50 text-red-700 ring-red-200",
  error: "bg-red-50 text-red-700 ring-red-200",
  review: "bg-amber-50 text-amber-700 ring-amber-200",
  interrupted: "bg-amber-50 text-amber-700 ring-amber-200",
  running: "bg-brand-50 text-brand-700 ring-brand-200",
  committed: "bg-brand-50 text-brand-700 ring-brand-200",
  idle: "bg-slate-50 text-slate-600 ring-slate-200",
};

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold tracking-normal ring-1",
        STATUS_STYLES[status] ?? STATUS_STYLES.idle,
      )}
    >
      {status === "running" && <Spinner className="h-3 w-3" />}
      {children ?? status}
    </span>
  );
}

/** The round green check / amber ? / red ✕ used on every list row. */
export function StatusIcon({ status, size = 28 }: { status: string; size?: number }) {
  const map: Record<string, [string, ReactNode]> = {
    eligible: ["bg-ok", <path key="c" d="M5 12.5l4.2 4L19 7" />],
    pass: ["bg-ok", <path key="c" d="M5 12.5l4.2 4L19 7" />],
    rejected: ["bg-red-500", <path key="x" d="M7 7l10 10M17 7L7 17" />],
    fail: ["bg-red-500", <path key="x" d="M7 7l10 10M17 7L7 17" />],
    review: ["bg-amber-400", <path key="q" d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.2v.3" />],
  };
  const [bg, icon] = map[status] ?? map.review;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-full text-white shadow-sm", bg)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </span>
  );
}

const AVATAR_GRADIENTS = [
  "from-brand-400 to-brand-700",
  "from-kbfc-sun to-amber-500 text-brand-900!",
  "from-sky-400 to-brand-600",
  "from-brand-600 to-brand-900",
  "from-amber-300 to-kbfc-yellow text-brand-900!",
  "from-cyan-400 to-brand-500",
];

export function Avatar({ name, size = 44, ring }: { name: string; size?: number; ring?: "gold" | "silver" | "bronze" | null }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  const rings = { gold: "ring-4 ring-kbfc-yellow", silver: "ring-4 ring-slate-200", bronze: "ring-4 ring-orange-300" };
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white shadow-md",
        AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length],
        ring && rings[ring],
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {letters}
    </span>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  const styles = {
    info: "bg-brand-50 text-brand-900 ring-brand-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    error: "bg-red-50 text-red-900 ring-red-200",
    success: "bg-green-50 text-green-900 ring-green-200",
  };
  const icons = { info: "ℹ️", warn: "⚠️", error: "⛔", success: "✅" };
  return (
    <div className={cx("animate-rise flex gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ring-1", styles[kind])}>
      <span aria-hidden>{icons[kind]}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Stat({ label, value, tone, icon }: { label: string; value: ReactNode; tone?: "green" | "amber" | "red"; icon?: ReactNode }) {
  const tones = { green: "text-green-600", amber: "text-amber-600", red: "text-red-600" };
  return (
    <div className="animate-rise rounded-2xl bg-white px-4 py-3.5 text-slate-800 shadow-card ring-1 ring-slate-100">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {icon}
      </div>
      <div className={cx("font-display mt-1 text-4xl leading-none tabular-nums", tone ? tones[tone] : "text-brand-700")}>{value}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={cx("relative h-6 w-11 rounded-full outline-none transition focus-visible:ring-4 focus-visible:ring-kbfc-yellow/50", checked ? "bg-brand-600" : "bg-slate-300")}
      >
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full shadow transition-all", checked ? "left-[22px] bg-kbfc-yellow" : "left-0.5 bg-white")} />
      </span>
      {label}
    </label>
  );
}

export function PillTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: ReactNode }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // keep the selected tab visible when the bar scrolls sideways on phones
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (box && el) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }, [value]);
  return (
    <div ref={ref} role="tablist" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-kbfc-navy/70 p-1.5 ring-1 ring-white/10 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cx(
            "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
            value === o.key ? "bg-kbfc-yellow text-brand-900 shadow-glow" : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- toasts ---------- */

interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
}
let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(kind: ToastItem["kind"], title: string, body?: string) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, title, body }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, kind === "error" ? 7000 : 4000);
}

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="animate-pop pointer-events-auto flex items-start gap-3 rounded-2xl bg-white p-3.5 text-slate-800 shadow-card ring-1 ring-slate-100">
          <StatusIcon status={t.kind === "success" ? "pass" : t.kind === "error" ? "fail" : "review"} size={26} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-slate-500">{t.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export async function copyText(text: string, what = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast("success", what);
  } catch {
    toast("error", "Couldn't copy - select the text manually");
  }
}

/** Hand-drawn curved arrow, like the marketing shots. */
export function CurvyArrow({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 80 70" className={cx("h-14 w-16 text-white/90", className)} style={flip ? { transform: "scaleX(-1)" } : undefined} fill="none" aria-hidden>
      <path d="M8 6c-2 22 8 44 52 52" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M50 48l11 10-14 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export { cx };
