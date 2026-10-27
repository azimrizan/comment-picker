"use client";

import { useRef, useState, type ReactNode } from "react";
import { Alert, Button, Card, Field, Input, Textarea, Toggle, toast } from "@/components/ui";
import { api, uploadFollowerFiles } from "@/lib/client";
import { defaultRule, QUICK_RULES, RULE_CATALOG, type ContestRules, type Rule, type RuleType } from "@/lib/rules/types";
import type { TabProps } from "./types";

// datetime-local <-> ISO (browser local time, i.e. IST for you)
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function ListInput({ value, onChange, placeholder, rows = 3 }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; rows?: number }) {
  const [raw, setRaw] = useState(value.join("\n"));
  return (
    <Textarea
      rows={rows}
      value={raw}
      placeholder={placeholder}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean));
      }}
    />
  );
}

function NumberInput({ value, onChange, allowEmpty }: { value: number | null; onChange: (v: number | null) => void; allowEmpty?: boolean }) {
  return (
    <Input
      type="number"
      min={0}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? (allowEmpty ? null : 0) : Number(e.target.value))}
    />
  );
}

function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function RuleFields({ rule, set, aiAvailable }: { rule: Rule; set: (r: Rule) => void; aiAvailable: boolean }) {
  switch (rule.type) {
    case "deadline":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start (optional)">
            <Input type="datetime-local" value={toLocal(rule.start)} onChange={(e) => set({ ...rule, start: fromLocal(e.target.value) })} />
          </Field>
          <Field label="Deadline">
            <Input type="datetime-local" value={toLocal(rule.end)} onChange={(e) => set({ ...rule, end: fromLocal(e.target.value) })} />
          </Field>
        </div>
      );
    case "must_follow":
      return <p className="text-sm text-slate-600">Checked against the followers export uploaded in step 1.</p>;
    case "mentions":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum friends tagged">
            <NumberInput value={rule.min} onChange={(v) => set({ ...rule, min: v ?? 1 })} />
          </Field>
          <Field label="Maximum (optional)">
            <NumberInput value={rule.max} allowEmpty onChange={(v) => set({ ...rule, max: v })} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <Toggle checked={rule.excludeSelf} onChange={(v) => set({ ...rule, excludeSelf: v })} label="Tagging yourself doesn't count" />
            <br />
            <Toggle checked={rule.excludeHost} onChange={(v) => set({ ...rule, excludeHost: v })} label="Tagging our own account doesn't count" />
          </div>
          <div className="sm:col-span-2">
            <Field label="Other accounts that don't count as friends" hint="e.g. @keralablasters, players. One per line.">
              <ListInput value={rule.excludeAccounts} onChange={(v) => set({ ...rule, excludeAccounts: v })} placeholder="@keralablasters" />
            </Field>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">Each friend is counted once even if tagged twice.</p>
        </div>
      );
    case "keywords":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Words / hashtags" hint="One per line. Whole-word match, case-insensitive (#KBFC won't match #KBFCfans).">
            <ListInput value={rule.terms} onChange={(v) => set({ ...rule, terms: v })} placeholder="#KBFCPredictAndWin" />
          </Field>
          <Field label="Must contain">
            <Select value={rule.mode} onChange={(v) => set({ ...rule, mode: v })} options={[["all", "All of them"], ["any", "Any one"]]} />
          </Field>
        </div>
      );
    case "forbidden_words":
      return (
        <Field label="Forbidden words" hint="One per line.">
          <ListInput value={rule.terms} onChange={(v) => set({ ...rule, terms: v })} />
        </Field>
      );
    case "min_words":
      return (
        <Field label="Minimum words (tags not counted)">
          <NumberInput value={rule.count} onChange={(v) => set({ ...rule, count: v ?? 1 })} />
        </Field>
      );
    case "exclude_users":
      return (
        <Field label="Usernames that can't win" hint="Admins, page staff, previous winners… one per line.">
          <ListInput value={rule.usernames} onChange={(v) => set({ ...rule, usernames: v })} rows={4} />
        </Field>
      );
    case "not_hidden":
      return <p className="text-sm text-slate-600">Comments you hid on Instagram are rejected.</p>;
    case "score_prediction":
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Home team (first in “2-1”)">
              <Input value={rule.homeTeam} onChange={(e) => set({ ...rule, homeTeam: e.target.value })} />
            </Field>
            <Field label="Away team">
              <Input value={rule.awayTeam} onChange={(e) => set({ ...rule, awayTeam: e.target.value })} placeholder="Bengaluru FC" />
            </Field>
            <Field label="Names fans use for home team" hint="One per line - include Malayalam and nicknames.">
              <ListInput value={rule.homeAliases} onChange={(v) => set({ ...rule, homeAliases: v })} rows={4} />
            </Field>
            <Field label="Names fans use for away team">
              <ListInput value={rule.awayAliases} onChange={(v) => set({ ...rule, awayAliases: v })} rows={4} placeholder={"bfc\nbengaluru\nbangalore"} />
            </Field>
          </div>
          <div className="rounded-lg bg-brand-50 p-3">
            <p className="mb-2 text-sm font-medium">Actual final score (fill in after the match)</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">{rule.homeTeam || "Home"}</span>
              <div className="w-20"><NumberInput value={rule.homeScore} allowEmpty onChange={(v) => set({ ...rule, homeScore: v })} /></div>
              <span>-</span>
              <div className="w-20"><NumberInput value={rule.awayScore} allowEmpty onChange={(v) => set({ ...rule, awayScore: v })} /></div>
              <span className="text-sm">{rule.awayTeam || "Away"}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="If a comment predicts two different scores">
              <Select value={rule.multiple} onChange={(v) => set({ ...rule, multiple: v })} options={[["review", "Send to manual review"], ["fail", "Reject"]]} />
            </Field>
            <div className="pt-6">
              <Toggle checked={rule.useAI} onChange={(v) => set({ ...rule, useAI: v })} label="Use AI for unclear comments" />
              {!aiAvailable && rule.useAI && <p className="mt-1 text-xs text-amber-700">ANTHROPIC_API_KEY not set - unclear ones will stay in review.</p>}
            </div>
          </div>
        </div>
      );
    case "answer":
      return (
        <div className="space-y-3">
          <Field label="Question">
            <Input value={rule.label} onChange={(e) => set({ ...rule, label: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Correct answer(s)" hint="One answer per line; spellings separated by | e.g. Noah Sadaoui|Noah|നോവ">
              <ListInput value={rule.correct} onChange={(v) => set({ ...rule, correct: v })} />
            </Field>
            <Field label="Other options (optional)" hint="Other players etc. - catches hedged answers like “Noah or Luna”.">
              <ListInput value={rule.others} onChange={(v) => set({ ...rule, others: v })} />
            </Field>
            <Field label="With several correct answers">
              <Select value={rule.mode} onChange={(v) => set({ ...rule, mode: v })} options={[["any", "Naming any one is enough"], ["all", "Must name all of them"]]} />
            </Field>
            <Field label="If the comment also names another option">
              <Select value={rule.multiple} onChange={(v) => set({ ...rule, multiple: v })} options={[["review", "Send to manual review"], ["fail", "Reject"]]} />
            </Field>
          </div>
          <Toggle checked={rule.fuzzy} onChange={(v) => set({ ...rule, fuzzy: v })} label="Send near-misspellings to review (e.g. “Sadaoi”)" />
        </div>
      );
  }
}

function QuickRow({ title, hint, on, onToggle, children }: { title: string; hint: string; on: boolean; onToggle: (v: boolean) => void; children?: ReactNode }) {
  return (
    <div className={on ? "rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100" : "rounded-2xl p-4 ring-1 ring-slate-100"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <Toggle checked={on} onChange={onToggle} />
      </div>
      {on && children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function Count({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
      {label}
      <span className="flex items-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
        <button type="button" className="px-3 py-1.5 text-lg disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
          className="w-12 bg-transparent text-center text-base font-semibold tabular-nums outline-none"
        />
        <button type="button" className="px-3 py-1.5 text-lg" onClick={() => onChange(value + 1)}>+</button>
      </span>
    </label>
  );
}

type Summary = { entries: number; eligible: number; review: number; rejected: number; aiError: string | null };

export default function RulesTab({ detail, reload, onRan, onPicked }: TabProps & { onRan: () => void; onPicked: () => void }) {
  const [cfg, setCfg] = useState<ContestRules>(detail.rules);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "check" | "pick">(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "warn"; text: string } | null>(null);
  const [adding, setAdding] = useState<RuleType>("score_prediction");
  const [winners, setWinners] = useState(detail.draw?.numWinners ?? 1);
  const [backups, setBackups] = useState(detail.draw?.numBackups ?? 2);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = detail.contest.id;

  async function uploadFollowers(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMsg(null);
    try {
      const r = await uploadFollowerFiles(id, files);
      toast("success", `${r.count.toLocaleString()} followers loaded`);
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveOnly() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ ruleErrors: string[] }>(`/api/contests/${id}`, { method: "PATCH", json: { rules: cfg } });
      setDirty(false);
      if (r.ruleErrors.length) setMsg({ kind: "warn", text: r.ruleErrors.join(" ") });
      else toast("success", "Rules saved");
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const update = (next: ContestRules) => {
    setCfg(next);
    setDirty(true);
  };
  const setRule = (i: number, r: Rule) => update({ ...cfg, rules: cfg.rules.map((x, j) => (j === i ? r : x)) });

  // The checklist edits the first rule of each quick type; anything else is shown under "More rules".
  const quickIndex = (t: RuleType) => cfg.rules.findIndex((r) => r.type === t);
  const quick = <T extends RuleType>(t: T) => cfg.rules[quickIndex(t)] as Extract<Rule, { type: T }> | undefined;
  const putQuick = (r: Rule) => {
    const i = quickIndex(r.type);
    update({ ...cfg, rules: i >= 0 ? cfg.rules.map((x, j) => (j === i ? r : x)) : [...cfg.rules, r] });
  };
  const toggleQuick = (t: RuleType, on: boolean) => putQuick({ ...(quick(t) ?? defaultRule(t)), enabled: on } as Rule);
  const isOn = (t: RuleType) => Boolean(quick(t)?.enabled);
  const advanced = cfg.rules.map((r, i) => ({ r, i })).filter(({ r, i }) => !QUICK_RULES.includes(r.type) || quickIndex(r.type) !== i);
  const advancedTypes = (Object.keys(RULE_CATALOG) as RuleType[]).filter((t) => !QUICK_RULES.includes(t));

  const mentions = quick("mentions");
  const keywords = quick("keywords");
  const deadline = quick("deadline");
  const exclude = quick("exclude_users");

  const noComments = !detail.stats.total;
  const fetching = detail.fetch.status === "running";
  const blocker = fetching ? "Wait for the comments to finish loading." : noComments ? "Get the comments first (step 1)." : null;

  async function saveAndCheck(): Promise<Summary> {
    const r = await api<{ ruleErrors: string[] }>(`/api/contests/${id}`, { method: "PATCH", json: { rules: cfg } });
    setDirty(false);
    if (r.ruleErrors.length) throw new Error(r.ruleErrors.join(" "));
    const s = await api<Summary>(`/api/contests/${id}/check`, { method: "POST" });
    if (s.aiError) toast("info", "AI fallback skipped", s.aiError);
    return s;
  }

  async function check() {
    setBusy("check");
    setMsg(null);
    try {
      const s = await saveAndCheck();
      await reload();
      toast("success", `Checked ${s.entries.toLocaleString()} comments`, `${s.eligible.toLocaleString()} eligible · ${s.review.toLocaleString()} need review · ${s.rejected.toLocaleString()} rejected`);
      onRan();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function pick() {
    if (detail.draw && !confirm("Winners were already picked for this contest. Pick new ones? The old result stays in the audit log.")) return;
    setBusy("pick");
    setMsg(null);
    try {
      const s = await saveAndCheck();
      if (s.eligible < winners) {
        await reload();
        throw new Error(
          `Only ${s.eligible.toLocaleString()} ${s.eligible === 1 ? "person follows" : "people follow"} the rules - not enough for ${winners} winner${winners > 1 ? "s" : ""}.` +
            (s.review ? ` ${s.review.toLocaleString()} more need a manual look in the Entries tab.` : " Turn off some rules and try again."),
        );
      }
      const draw = (action: string) => api(`/api/contests/${id}/draw`, { method: "POST", json: { action, winners, backups } });
      if (detail.draw) await draw("reset");
      await draw("commit");
      await draw("draw");
      await reload();
      if (s.review) toast("info", `${s.review.toLocaleString()} entries skipped`, "They need a manual look, so they weren't in this draw.");
      onPicked();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card title="Who can win">
        <div className="space-y-3">
          <QuickRow title="Must tag friends" hint="The comment @mentions other accounts." on={isOn("mentions")} onToggle={(v) => toggleQuick("mentions", v)}>
            {mentions && (
              <div className="max-w-56">
                <Field label="At least this many friends">
                  <NumberInput value={mentions.min} onChange={(v) => putQuick({ ...mentions, min: Math.max(1, v ?? 1) })} />
                </Field>
              </div>
            )}
          </QuickRow>
          <QuickRow title="Must include a hashtag or word" hint="e.g. #KBFCPredictAndWin" on={isOn("keywords")} onToggle={(v) => toggleQuick("keywords", v)}>
            {keywords && <RuleFields rule={keywords} set={putQuick} aiAvailable={detail.aiAvailable} />}
          </QuickRow>
          <QuickRow title="Must comment before a deadline" hint="Late comments don't count." on={isOn("deadline")} onToggle={(v) => toggleQuick("deadline", v)}>
            {deadline && <RuleFields rule={deadline} set={putQuick} aiAvailable={detail.aiAvailable} />}
          </QuickRow>
          <QuickRow title="Must follow the account" hint="Needs the followers export from Instagram (upload it in step 1)." on={isOn("must_follow")} onToggle={(v) => toggleQuick("must_follow", v)}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-slate-600">
                {detail.followers
                  ? `${detail.followers.count.toLocaleString()} followers loaded from ${detail.followers.files.join(", ")}.`
                  : "Upload followers_1.json from Instagram's export (connections/followers_and_following/). Select all followers_N.json files together."}
              </p>
              <input ref={fileRef} type="file" multiple accept=".json,.html,.txt,.csv" className="hidden" onChange={(e) => uploadFollowers(e.target.files)} />
              <Button variant={detail.followers ? "secondary" : "primary"} loading={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Reading…" : detail.followers ? "Replace list" : "Upload followers list"}
              </Button>
            </div>
          </QuickRow>
          <QuickRow title="Skip comments I hid" hint="Comments you hid on Instagram can't win." on={isOn("not_hidden")} onToggle={(v) => toggleQuick("not_hidden", v)} />
          <QuickRow title="Never pick these accounts" hint="Admins, staff, past winners…" on={isOn("exclude_users")} onToggle={(v) => toggleQuick("exclude_users", v)}>
            {exclude && <RuleFields rule={exclude} set={putQuick} aiAvailable={detail.aiAvailable} />}
          </QuickRow>
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Field label="If someone comments more than once">
            <Select
              value={cfg.entryPolicy}
              onChange={(v) => update({ ...cfg, entryPolicy: v })}
              options={[
                ["best", "Count them once (any valid comment)"],
                ["first_only", "Only their first comment counts"],
                ["disqualify_multiple", "Disqualify them"],
              ]}
            />
          </Field>
          <div className="sm:pt-6">
            <Toggle checked={cfg.includeReplies} onChange={(v) => update({ ...cfg, includeReplies: v })} label="Replies to other comments also count" />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Each person can win once. Comments by @{detail.contest.hostUsername} are always ignored.</p>
      </Card>

      <details className="glass rounded-3xl p-4" open={advanced.length > 0}>
        <summary className="cursor-pointer font-semibold">More rules (score prediction, quiz answer, banned words…)</summary>
        <div className="mt-4 space-y-4">
          {advanced.map(({ r: rule, i }) => (
            <Card
              key={rule.id}
              className={rule.enabled ? "" : "opacity-60"}
              title={
                <span>
                  {rule.type === "answer" ? rule.label || RULE_CATALOG.answer.label : RULE_CATALOG[rule.type].label}
                  <span className="ml-2 text-xs font-normal text-white/65">{RULE_CATALOG[rule.type].description}</span>
                </span>
              }
              actions={
                <>
                  <Toggle checked={rule.enabled} onChange={(v) => setRule(i, { ...rule, enabled: v } as Rule)} label={rule.enabled ? "On" : "Off"} />
                  <Button variant="ghost" onClick={() => update({ ...cfg, rules: cfg.rules.filter((_, j) => j !== i) })}>Remove</Button>
                </>
              }
            >
              {rule.enabled && <RuleFields rule={rule} set={(r) => setRule(i, r)} aiAvailable={detail.aiAvailable} />}
            </Card>
          ))}
          <Card>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <Field label="Add a rule">
                  <Select value={adding} onChange={setAdding} options={advancedTypes.map((t) => [t, RULE_CATALOG[t].label])} />
                </Field>
              </div>
              <Button variant="secondary" onClick={() => update({ ...cfg, rules: [...cfg.rules, defaultRule(adding)] })}>+ Add</Button>
            </div>
          </Card>
        </div>
      </details>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="sticky bottom-4 z-30 rounded-2xl bg-white px-4 py-3 text-slate-800 shadow-card">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Count label="Winners" value={winners} min={1} onChange={setWinners} />
          <Count label="Backups" value={backups} min={0} onChange={setBackups} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {dirty && (
              <Button variant="ghost" className="text-amber-700" loading={saving} disabled={Boolean(busy)} onClick={saveOnly}>
                Save rules
              </Button>
            )}
            <Button variant="secondary" loading={busy === "check"} disabled={Boolean(busy || blocker)} onClick={check}>
              Check entries only
            </Button>
            <Button loading={busy === "pick"} disabled={Boolean(busy || blocker)} onClick={pick} className="px-6">
              {busy === "pick" ? "Picking…" : `🎲 Pick ${winners} winner${winners > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
        {blocker && <p className="mt-2 text-xs font-medium text-amber-700">{blocker}</p>}
      </div>
    </div>
  );
}
