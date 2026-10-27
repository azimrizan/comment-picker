"use client";

import { parseFollowerFile } from "./followers";

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status})`) as Error & { errors?: string[] };
    err.errors = data.errors;
    throw err;
  }
  return data as T;
}

/** Read Instagram's followers export in the browser and upload just the usernames. */
export async function uploadFollowerFiles(contestId: number, files: FileList) {
  const set = new Set<string>();
  for (const f of Array.from(files)) parseFollowerFile(f.name, await f.text(), set);
  if (!set.size) throw new Error("No usernames found in those files. Upload followers_1.json from the Instagram export.");
  return api<{ count: number }>(`/api/contests/${contestId}/followers`, {
    method: "POST",
    json: { usernames: [...set], files: Array.from(files, (f) => f.name) },
  });
}

export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
