#!/usr/bin/env node
// Copy everything from the local database (~/.comment-picker/picker.db) into Turso, once, before going live.
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/copy-to-turso.mjs
// Run it against an empty Turso database (don't create contests there before copying).
// Tables are created from the local database's own definitions. Rows with the same id are overwritten.
import { createClient } from "@libsql/client";
import os from "node:os";
import path from "node:path";

const localPath = process.env.DATABASE_PATH ?? path.join(os.homedir(), ".comment-picker", "picker.db");
if (!process.env.TURSO_DATABASE_URL) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first.");
  process.exit(1);
}
const local = createClient({ url: `file:${localPath}` });
const remote = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Parents before children doesn't matter (no foreign keys), but keep a readable order.
const TABLES = ["settings", "contests", "comments", "followers", "participants", "overrides", "ai_cache", "draws", "audit_log"];
const CHUNK = 300;

// Same tables and indexes as the local database, including columns added by later migrations.
const ddl = await local.execute("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'");
for (const row of ddl.rows) {
  await remote.execute(String(row.sql).replace(/^CREATE (TABLE|INDEX) (?!IF NOT EXISTS)/, "CREATE $1 IF NOT EXISTS "));
}

for (const table of TABLES) {
  const remoteCols = new Set((await remote.execute(`PRAGMA table_info(${table})`)).rows.map((r) => r.name));
  if (!remoteCols.size) {
    console.error(`Table ${table} couldn't be created in Turso.`);
    process.exit(1);
  }
  const rs = await local.execute(`SELECT * FROM ${table}`);
  const cols = rs.columns.filter((c) => remoteCols.has(c));
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  for (let i = 0; i < rs.rows.length; i += CHUNK) {
    const chunk = rs.rows.slice(i, i + CHUNK);
    await remote.batch(chunk.map((row) => ({ sql, args: cols.map((c) => row[rs.columns.indexOf(c)]) })), "write");
  }
  console.log(`${table}: ${rs.rows.length} rows copied`);
}
console.log("Done.");
