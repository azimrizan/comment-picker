import { getSetting, setSetting } from "./db";

// Instagram API with Instagram Login uses graph.instagram.com and "me".
// If you connect through a Facebook Page instead, set IG_GRAPH_BASE=https://graph.facebook.com
// and IG_USER_ID=<your instagram business account id>.
export const GRAPH_BASE = (process.env.IG_GRAPH_BASE ?? "https://graph.instagram.com").replace(/\/$/, "");
export const IG_USER_ID = process.env.IG_USER_ID ?? "me";

export async function accessToken(): Promise<string> {
  const t = (await getSetting("ig_access_token")) ?? process.env.IG_ACCESS_TOKEN;
  if (!t) throw new IgError("No Instagram access token. Add one on the Settings page.", 0);
  return t;
}

export class IgError extends Error {
  constructor(
    message: string,
    public code: number,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80006]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function usageWaitMs(headers: Headers): number | undefined {
  for (const h of ["x-business-use-case-usage", "x-app-usage", "x-ad-account-usage"]) {
    const v = headers.get(h);
    if (!v) continue;
    const m = v.match(/"estimated_time_to_regain_access"\s*:\s*(\d+)/);
    if (m && Number(m[1]) > 0) return Number(m[1]) * 60_000;
  }
  return undefined;
}

type Notify = (msg: string | null) => void;

/** True when Instagram asked us to wait longer than the caller can; retryAfterMs says how long. */
export const isRateLimit = (e: unknown): e is IgError => e instanceof IgError && e.retryAfterMs != null;

/**
 * GET with retries: rate limits wait (up to ~1h total), network/5xx errors retry 5 times.
 * A rate-limit wait longer than maxWaitMs is thrown instead, so short serverless calls can hand it back to the browser.
 */
export async function igGet<T>(
  urlOrPath: string,
  params: Record<string, string> = {},
  notify?: Notify,
  maxWaitMs = 15 * 60_000,
): Promise<T> {
  const url = new URL(urlOrPath.startsWith("http") ? urlOrPath : `${GRAPH_BASE}/${urlOrPath.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", await accessToken());

  let transientTries = 0;
  let rateWaited = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch (e) {
      if (++transientTries > 5) throw new IgError(`Network error: ${(e as Error).message}`, -1);
      notify?.(`Network error, retrying (${transientTries}/5)…`);
      await sleep(2000 * 2 ** transientTries);
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: { message: string; code: number } } & T;
    if (res.ok && !body.error) {
      notify?.(null);
      return body;
    }
    const code = body.error?.code ?? res.status;
    const message = body.error?.message ?? `HTTP ${res.status}`;

    if (RATE_LIMIT_CODES.has(code) || res.status === 429) {
      const wait = Math.min(usageWaitMs(res.headers) ?? 60_000 * 2 ** Math.min(rateWaited / 60_000, 4), 15 * 60_000);
      if (rateWaited + wait > 60 * 60_000) throw new IgError(`Rate limited for over an hour: ${message}`, code, wait);
      if (wait > maxWaitMs) throw new IgError(`Instagram rate limit: ${message}`, code, wait);
      notify?.(`Instagram rate limit hit - waiting ${Math.round(wait / 1000)}s before continuing…`);
      rateWaited += wait;
      await sleep(wait);
      continue;
    }
    if (res.status >= 500 || code === 1 || code === 2) {
      if (++transientTries > 5) throw new IgError(message, code);
      notify?.(`Instagram temporary error, retrying (${transientTries}/5)…`);
      await sleep(2000 * 2 ** transientTries);
      continue;
    }
    throw new IgError(message, code);
  }
}

export interface IgAccount {
  id: string;
  username: string;
}

export function getAccount() {
  return igGet<IgAccount>(IG_USER_ID, { fields: "id,username" });
}

export interface IgMedia {
  id: string;
  shortcode?: string;
  permalink?: string;
  caption?: string;
  comments_count?: number;
  timestamp?: string;
  media_type?: string;
  thumbnail_url?: string;
  media_url?: string;
}

const MEDIA_FIELDS = "id,shortcode,permalink,caption,comments_count,timestamp,media_type,thumbnail_url,media_url";

export function shortcodeFromUrl(input: string): string | null {
  const m = input.match(/instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

interface Page<T> {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string } };
}

/** Find one of *your own* posts by its URL (or numeric media id). */
export async function resolveMedia(input: string): Promise<IgMedia> {
  const trimmed = input.trim();
  if (/^\d{8,}$/.test(trimmed)) return getMedia(trimmed);
  const code = shortcodeFromUrl(trimmed);
  if (!code) throw new IgError("That doesn't look like an Instagram post or reel URL.", 0);

  let next: string | undefined = `${IG_USER_ID}/media`;
  let params: Record<string, string> = { fields: MEDIA_FIELDS, limit: "50" };
  let scanned = 0;
  while (next && scanned < 5000) {
    const page: Page<IgMedia> = await igGet<Page<IgMedia>>(next, params);
    for (const m of page.data) {
      if (m.shortcode === code || m.permalink?.includes(`/${code}`)) return m;
    }
    scanned += page.data.length;
    next = page.paging?.next;
    params = {};
  }
  throw new IgError(
    "Post not found on the connected account. The post must be on the Instagram account whose token you added.",
    0,
  );
}

export function getMedia(id: string) {
  return igGet<IgMedia>(id, { fields: MEDIA_FIELDS });
}

export function recentMedia() {
  return igGet<Page<IgMedia>>(`${IG_USER_ID}/media`, { fields: MEDIA_FIELDS, limit: "24" });
}

export interface IgComment {
  id: string;
  text?: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username: string };
  like_count?: number;
  hidden?: boolean;
  replies?: Page<IgComment>;
}

const C_FULL = "id,text,timestamp,username,from{id,username},like_count,hidden";
const C_MIN = "id,text,timestamp,username";
export const COMMENT_FIELD_SETS = [
  `${C_FULL},replies.limit(50){${C_FULL}}`,
  `${C_MIN},replies{${C_MIN}}`,
];

export async function refreshLongLivedToken(): Promise<{ expiresInDays: number }> {
  const res = await igGet<{ access_token: string; expires_in: number }>("refresh_access_token", {
    grant_type: "ig_refresh_token",
  });
  await setSetting("ig_access_token", res.access_token);
  await setSetting("ig_token_refreshed_at", new Date().toISOString());
  return { expiresInDays: Math.round(res.expires_in / 86400) };
}

export type { Page };
