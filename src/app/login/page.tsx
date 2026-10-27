"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { Football } from "@/components/graphics";
import { api } from "@/lib/client";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/login", { method: "POST", json: { password } });
      const next = new URLSearchParams(window.location.search).get("next");
      // Only follow same-site paths.
      window.location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <div className="text-center">
        <Football className="animate-bounce-ball mx-auto h-16 w-16" />
        <h1 className="font-display mt-4 text-5xl">Matchday access</h1>
        <p className="mt-1 text-sm text-white/70">Enter the admin password to manage contests.</p>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Admin password">
            <Input id="password" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" loading={busy} disabled={!password} className="w-full py-3">
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
