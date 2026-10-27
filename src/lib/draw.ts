import { createHash, createHmac, randomBytes } from "node:crypto";
import { all, audit, get, nowIso, run } from "./db";
import { finalStatusSql } from "./contests";

// Provably fair draw (commit → reveal):
// 1. Commit: freeze the eligible list (pool hash) and a secret random seed (seed hash).
//    Publish both hashes before drawing.
// 2. Draw: shuffle the pool with HMAC-SHA256(seed, counter) and reveal the seed.
//    Anyone can re-run scripts/verify-draw.mjs with the seed + pool to get the same winners.

export interface PoolEntry {
  userKey: string;
  username: string;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function eligiblePool(contestId: number) {
  return all<PoolEntry>(
    `SELECT p.user_key AS userKey, p.username FROM participants p
     LEFT JOIN overrides o ON o.contest_id = p.contest_id AND o.user_key = p.user_key
     WHERE p.contest_id = ? AND ${finalStatusSql()} = 'eligible' ORDER BY p.user_key`,
    contestId,
  );
}

export function poolText(pool: PoolEntry[]) {
  return pool.map((p) => `${p.userKey}:${p.username}`).join("\n");
}

export function shuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let counter = 0;
  let buf = Buffer.alloc(0);
  const nextU32 = () => {
    if (buf.length < 4) buf = Buffer.concat([buf, createHmac("sha256", seed).update(String(counter++)).digest()]);
    const v = buf.readUInt32BE(0);
    buf = buf.subarray(4);
    return v;
  };
  const randInt = (n: number) => {
    const limit = Math.floor(0x100000000 / n) * n; // rejection sampling: no modulo bias
    let v: number;
    do v = nextU32();
    while (v >= limit);
    return v % n;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface DrawRow {
  id: number;
  contest_id: number;
  status: "committed" | "drawn" | "void";
  seed: string;
  seed_hash: string;
  pool_hash: string;
  pool_json: string;
  num_winners: number;
  num_backups: number;
  committed_at: string;
  drawn_at: string | null;
  result_json: string | null;
}

export function activeDraw(contestId: number) {
  return get<DrawRow>("SELECT * FROM draws WHERE contest_id = ? AND status != 'void' ORDER BY id DESC LIMIT 1", contestId);
}

export async function commitDraw(contestId: number, numWinners: number, numBackups: number) {
  if (await activeDraw(contestId)) throw new Error("A draw is already committed. Reset it first.");
  if (!Number.isInteger(numWinners) || numWinners < 1) throw new Error("Number of winners must be at least 1.");
  if (!Number.isInteger(numBackups) || numBackups < 0) throw new Error("Backups can't be negative.");
  const pool = await eligiblePool(contestId);
  if (pool.length < numWinners) throw new Error(`Only ${pool.length} eligible entries - fewer than ${numWinners} winners.`);
  const seed = randomBytes(32).toString("hex");
  await run(
    `INSERT INTO draws (contest_id, status, seed, seed_hash, pool_hash, pool_json, num_winners, num_backups, committed_at)
     VALUES (?, 'committed', ?, ?, ?, ?, ?, ?, ?)`,
    contestId,
    seed,
    sha256(seed),
    sha256(poolText(pool)),
    JSON.stringify(pool),
    numWinners,
    numBackups,
    nowIso(),
  );
  await audit(contestId, "draw_committed", { pool: pool.length, numWinners, numBackups });
}

export async function runDraw(contestId: number) {
  const d = await activeDraw(contestId);
  if (!d || d.status !== "committed") throw new Error("Commit the draw first.");
  const pool = await eligiblePool(contestId);
  if (sha256(poolText(pool)) !== d.pool_hash) {
    throw new Error("Eligible entries changed since the commit (re-run checks or an override?). Reset and commit again.");
  }
  const order = shuffle(pool, d.seed);
  const take = Math.min(order.length, d.num_winners + d.num_backups);
  const result = {
    winners: order.slice(0, d.num_winners),
    backups: order.slice(d.num_winners, take),
  };
  await run("UPDATE draws SET status = 'drawn', drawn_at = ?, result_json = ? WHERE id = ?", nowIso(), JSON.stringify(result), d.id);
  await audit(contestId, "draw_done", result);
}

export async function resetDraw(contestId: number) {
  const d = await activeDraw(contestId);
  if (!d) return;
  await run("UPDATE draws SET status = 'void' WHERE id = ?", d.id);
  await audit(contestId, "draw_reset", { drawId: d.id, previous: d.result_json ? JSON.parse(d.result_json) : null });
}
