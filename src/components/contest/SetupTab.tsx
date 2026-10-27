"use client";

import { useRef, useState } from "react";
import { Alert, Badge, Button, Card, Stat, toast } from "@/components/ui";
import { api, fmtTime, uploadFollowerFiles } from "@/lib/client";
import type { TabProps } from "./types";

export default function SetupTab({ detail, reload, onNext }: TabProps & { onNext: () => void }) {
  const { contest, fetch: f, stats, followers } = detail;
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function startFetch(resume: boolean) {
    setMsg(null);
    try {
      await api(`/api/contests/${contest.id}/fetch`, { method: "POST", json: { resume } });
      toast("info", resume ? "Resuming fetch…" : "Fetching all comments…", "You can keep working - progress updates live.");
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await uploadFollowerFiles(contest.id, files);
      toast("success", `${r.count.toLocaleString()} followers loaded`, "The “must follow” rule will use this list.");
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const deadline = detail.rules.rules.find((r) => r.type === "deadline" && r.enabled);
  const deadlineEnd = deadline && deadline.type === "deadline" ? deadline.end : null;
  const followersStale = followers && deadlineEnd && Date.parse(followers.uploadedAt) < Date.parse(deadlineEnd);
  const missing = contest.apiCommentsCount != null && f.status === "done" ? contest.apiCommentsCount - (stats.total - (stats.deleted ?? 0)) : null;
  const running = f.status === "running";

  return (
    <div className="space-y-5">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="grid items-start gap-5 md:grid-cols-[260px_1fr]">
        <Card>
          {contest.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contest.thumbnailUrl} alt="" className="mb-3 aspect-square w-full rounded-lg object-cover" />
          )}
          <p className="line-clamp-6 whitespace-pre-line text-sm text-slate-700">{contest.caption}</p>
        </Card>

        <Card
          title={<span className="flex items-center gap-2">Comments <Badge status={f.status} /></span>}
          actions={
            <>
              {f.canResume && <Button variant="glass" disabled={running} onClick={() => startFetch(true)}>Resume</Button>}
              <Button loading={running} onClick={() => startFetch(false)}>
                {running ? "Fetching…" : stats.total ? "Re-fetch all comments" : "Fetch all comments"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Instagram says" value={contest.apiCommentsCount?.toLocaleString() ?? "—"} />
            <Stat label="Fetched" value={(running ? f.fetched : stats.total).toLocaleString()} />
            <Stat label="Replies" value={(stats.replies ?? 0).toLocaleString()} />
            <Stat label="Unique users" value={stats.users.toLocaleString()} />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {running && contest.apiCommentsCount ? (
              <div className="h-2.5 overflow-hidden rounded-full bg-brand-50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-700"
                  style={{ width: `${Math.min(100, (f.fetched / contest.apiCommentsCount) * 100)}%` }}
                />
              </div>
            ) : null}
            {running && (
              <Alert kind="info">
                Fetching… {f.fetched.toLocaleString()} comments so far. Keep this page open - if you close it, the fetch pauses and
                continues when you come back.
                {f.note && <><br />{f.note}</>}
              </Alert>
            )}
            {f.status === "error" && <Alert kind="error">Fetch failed: {f.error}{f.canResume && " - click Resume to continue from where it stopped."}</Alert>}
            {f.status === "done" && (
              <p className="text-slate-600">
                Last full fetch finished {fmtTime(f.finishedAt)}. {stats.deleted ? `${stats.deleted} comment${stats.deleted === 1 ? " was" : "s were"} deleted since an earlier fetch. ` : ""}
                {stats.hidden ? `${stats.hidden} hidden by you. ` : ""}
              </p>
            )}
            {missing != null && missing > 0 && (
              <Alert kind="warn">
                Instagram&apos;s count is {missing.toLocaleString()} higher than what the API returned. This is normal for comments
                from restricted/blocked accounts, comments Instagram filtered as spam/offensive, or ones deleted just now -
                those can&apos;t be fetched by any tool. Re-fetch closer to the draw to be sure.
              </Alert>
            )}
            {missing != null && missing <= 0 && <Alert kind="success">Complete: every comment Instagram reports was fetched.</Alert>}
          </div>
          {f.status === "done" && stats.total > 0 && (
            <div className="mt-4 flex justify-end">
              <Button onClick={onNext}>Next: set rules & pick winners →</Button>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Followers list (for the “must follow” rule)"
        actions={
          <>
            <input ref={fileRef} type="file" multiple accept=".json,.html,.txt,.csv" className="hidden" onChange={(e) => upload(e.target.files)} />
            <Button variant={followers ? "glass" : "primary"} loading={busy} onClick={() => fileRef.current?.click()}>{busy ? "Reading…" : followers ? "Replace list" : "Upload followers export"}</Button>
          </>
        }
      >
        {followers ? (
          <p className="text-sm text-slate-700">
            <b>{followers.count.toLocaleString()}</b> followers loaded from {followers.files.join(", ")} on {fmtTime(followers.uploadedAt)}.
          </p>
        ) : (
          <p className="text-sm text-slate-600">No followers list yet. Entries will show “review” for the follow rule until you upload one.</p>
        )}
        {followersStale && (
          <div className="mt-3">
            <Alert kind="warn">
              This list was exported before the contest deadline. People who followed after that will be marked as not following.
              Request a fresh export after the deadline.
            </Alert>
          </div>
        )}
        <details className="mt-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-800">How to get the followers export (official, 100% accurate)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Instagram app → Settings → <b>Accounts Center</b> → <b>Your information and permissions</b> → <b>Download your information</b>.</li>
            <li>Choose <b>Download or transfer information</b> → the club account → <b>Some of your information</b> → tick <b>Followers and following</b>.</li>
            <li>Download to device, format <b>JSON</b>, date range <b>All time</b>. Instagram emails a link (minutes to a few hours).</li>
            <li>Unzip and upload <code>connections/followers_and_following/followers_1.json</code> (plus followers_2.json… if there are several - select them together).</li>
          </ol>
          <p className="mt-2">Instagram&apos;s API has no way to check who follows you, so this export is the only accurate source. Request it after the deadline.</p>
        </details>
      </Card>
    </div>
  );
}
