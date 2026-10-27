import { createClient, type Client, type InStatement, type InValue } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Production (Vercel) uses Turso via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// Locally it falls back to a SQLite file kept outside the project folder on purpose:
// the dev server watches the project, and SQLite touching its files there makes the page reload in an endless loop.
const LOCAL_PATH = process.env.DATABASE_PATH ?? path.join(os.homedir(), ".comment-picker", "picker.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  post_url TEXT NOT NULL,
  media_id TEXT NOT NULL,
  permalink TEXT,
  caption TEXT,
  media_type TEXT,
  thumbnail_url TEXT,
  media_timestamp TEXT,
  api_comments_count INTEGER,
  host_username TEXT,
  rules_json TEXT NOT NULL,
  fetch_status TEXT NOT NULL DEFAULT 'idle',
  fetch_run INTEGER NOT NULL DEFAULT 0,
  fetch_cursor TEXT,
  fetch_fetched INTEGER NOT NULL DEFAULT 0,
  fetch_note TEXT,
  fetch_error TEXT,
  fetch_started_at TEXT,
  fetch_finished_at TEXT,
  evaluated_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  contest_id INTEGER NOT NULL,
  id TEXT NOT NULL,
  parent_id TEXT,
  username TEXT NOT NULL,
  user_id TEXT,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  like_count INTEGER,
  hidden INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  last_seen_run INTEGER NOT NULL,
  eval_status TEXT,
  eval_json TEXT,
  PRIMARY KEY (contest_id, id)
);
CREATE INDEX IF NOT EXISTS comments_user ON comments (contest_id, username);

CREATE TABLE IF NOT EXISTS followers (
  contest_id INTEGER PRIMARY KEY,
  usernames TEXT NOT NULL,
  count INTEGER NOT NULL,
  source_files TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  contest_id INTEGER NOT NULL,
  user_key TEXT NOT NULL,
  username TEXT NOT NULL,
  auto_status TEXT NOT NULL,
  comment_id TEXT,
  comment_count INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  PRIMARY KEY (contest_id, user_key)
);

CREATE TABLE IF NOT EXISTS overrides (
  contest_id INTEGER NOT NULL,
  user_key TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (contest_id, user_key)
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  result_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  seed TEXT NOT NULL,
  seed_hash TEXT NOT NULL,
  pool_hash TEXT NOT NULL,
  pool_json TEXT NOT NULL,
  num_winners INTEGER NOT NULL,
  num_backups INTEGER NOT NULL,
  committed_at TEXT NOT NULL,
  drawn_at TEXT,
  result_json TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT
);
`;

// Columns added after the first release; ALTER fails harmlessly once they exist.
const MIGRATIONS = ["ALTER TABLE contests ADD COLUMN fetch_lease TEXT"];

const g = globalThis as unknown as { __pickerDb?: Promise<Client> };

async function open(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL;
  let client: Client;
  if (url) client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  else {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    client = createClient({ url: `file:${LOCAL_PATH}` });
  }
  await client.executeMultiple(SCHEMA);
  for (const m of MIGRATIONS) await client.execute(m).catch(() => {});
  return client;
}

export function db(): Promise<Client> {
  g.__pickerDb ??= open().catch((e) => {
    g.__pickerDb = undefined;
    throw e;
  });
  return g.__pickerDb;
}

export type Arg = InValue;

/** All rows as plain objects. */
export async function all<T = Record<string, unknown>>(sql: string, ...args: Arg[]): Promise<T[]> {
  const rs = await (await db()).execute({ sql, args });
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])) as T);
}

export async function get<T = Record<string, unknown>>(sql: string, ...args: Arg[]): Promise<T | undefined> {
  return (await all<T>(sql, ...args))[0];
}

export async function run(sql: string, ...args: Arg[]) {
  const rs = await (await db()).execute({ sql, args });
  return { changes: rs.rowsAffected, lastId: Number(rs.lastInsertRowid ?? 0) };
}

/** Run statements atomically in one round trip. */
export async function batch(statements: InStatement[]) {
  if (statements.length) await (await db()).batch(statements, "write");
}

export const stmt = (sql: string, ...args: Arg[]): InStatement => ({ sql, args });

export function nowIso() {
  return new Date().toISOString();
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}

export function auditStmt(contestId: number | null, action: string, details?: unknown) {
  return stmt(
    "INSERT INTO audit_log (contest_id, at, action, details) VALUES (?, ?, ?, ?)",
    contestId,
    nowIso(),
    action,
    details === undefined ? null : JSON.stringify(details),
  );
}

export async function audit(contestId: number | null, action: string, details?: unknown) {
  const { sql, args } = auditStmt(contestId, action, details) as { sql: string; args: Arg[] };
  await run(sql, ...args);
}
