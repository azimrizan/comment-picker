"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { api, fmtTime } from "@/lib/client";

interface Settings {
  tokenSource: "saved" | "env" | null;
  tokenSavedAt: string | null;
  tokenRefreshedAt: string | null;
  graphBase: string;
  igUserId: string;
  aiAvailable: boolean;
}

interface TestResult {
  account: { id: string; username: string };
  recent: { id: string; permalink?: string; caption?: string; comments_count?: number; thumbnail_url?: string; media_url?: string }[];
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<Settings>("/api/settings").then(setS);
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await fn();
      if (text) setMsg({ kind: "success", text });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Instagram connection">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Status:{" "}
            {s?.tokenSource ? (
              <b className="text-green-700">
                token {s.tokenSource === "saved" ? `saved ${fmtTime(s.tokenSavedAt)}` : "from IG_ACCESS_TOKEN env"}
              </b>
            ) : (
              <b className="text-red-700">no token</b>
            )}
            {s?.tokenRefreshedAt && <> · last refreshed {fmtTime(s.tokenRefreshedAt)}</>}
            <br />
            API: <code className="text-xs">{s?.graphBase}</code> · account id: <code className="text-xs">{s?.igUserId}</code>
          </p>
          <Field label="Long-lived access token" hint="Stored only in the local database on this computer.">
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGAA…" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !token} onClick={() => run(async () => {
              await api("/api/settings", { method: "POST", json: { token } });
              setToken("");
              return "Token saved.";
            })}>Save token</Button>
            <Button variant="secondary" disabled={busy || !s?.tokenSource} onClick={() => run(async () => {
              const r = await api<TestResult>("/api/settings/test", { method: "POST" });
              setTest(r);
              return `Connected as @${r.account.username}`;
            })}>Test connection</Button>
            <Button variant="secondary" disabled={busy || !s?.tokenSource} onClick={() => run(async () => {
              const r = await api<{ expiresInDays: number }>("/api/settings/refresh", { method: "POST" });
              return `Token refreshed - valid for ${r.expiresInDays} more days.`;
            })}>Refresh token (60 days)</Button>
          </div>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          {test && (
            <div>
              <p className="mb-2 text-sm font-medium">Recent posts on @{test.account.username}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {test.recent.map((m) => (
                  <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="block text-xs text-slate-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.thumbnail_url ?? m.media_url} alt="" className="aspect-square w-full rounded object-cover" />
                    {m.comments_count ?? 0} comments
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="AI fallback for unclear predictions">
        <p className="text-sm text-slate-600">
          {s?.aiAvailable ? (
            <b className="text-green-700">ANTHROPIC_API_KEY is set.</b>
          ) : (
            <b className="text-slate-700">Not configured (optional).</b>
          )}{" "}
          When enabled on a score-prediction rule, comments the parser can&apos;t read with certainty are read by Claude.
          Anything Claude isn&apos;t confident about still goes to manual review. Set <code>ANTHROPIC_API_KEY</code> in{" "}
          <code>.env.local</code> and restart to enable.
        </p>
      </Card>

      <Card title="How to get a token">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Switch the Instagram account to a <b>Professional</b> (Business or Creator) account.</li>
          <li>Go to developers.facebook.com → My Apps → Create app → choose the <b>Instagram</b> use case.</li>
          <li>Under <i>API setup with Instagram login</i>, add your Instagram account (you are the app admin, so no app review is needed).</li>
          <li>Grant <code>instagram_business_basic</code> and <code>instagram_business_manage_comments</code>, then click <b>Generate token</b>.</li>
          <li>Paste the token above. Click <b>Refresh token</b> at least once every 60 days to keep it alive.</li>
        </ol>
      </Card>
    </div>
  );
}
