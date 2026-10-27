#!/usr/bin/env node
// Independently re-run a draw:  node scripts/verify-draw.mjs <seed> <pool.txt> <winners> [backups]
// Prints the seed hash and pool hash (compare with what was published before the draw)
// and the winners in order. Same algorithm as src/lib/draw.ts.
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const [seed, poolFile, winnersArg, backupsArg = "0"] = process.argv.slice(2);
if (!seed || !poolFile || !winnersArg) {
  console.error("usage: node scripts/verify-draw.mjs <seed> <pool.txt> <winners> [backups]");
  process.exit(1);
}
const poolText = readFileSync(poolFile, "utf8").replace(/\n+$/, "");
const pool = poolText.split("\n");
const sha = (s) => createHash("sha256").update(s).digest("hex");

let counter = 0;
let buf = Buffer.alloc(0);
const nextU32 = () => {
  if (buf.length < 4) buf = Buffer.concat([buf, createHmac("sha256", seed).update(String(counter++)).digest()]);
  const v = buf.readUInt32BE(0);
  buf = buf.subarray(4);
  return v;
};
const randInt = (n) => {
  const limit = Math.floor(0x100000000 / n) * n;
  let v;
  do v = nextU32();
  while (v >= limit);
  return v % n;
};
const arr = [...pool];
for (let i = arr.length - 1; i > 0; i--) {
  const j = randInt(i + 1);
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

const w = Number(winnersArg);
const b = Number(backupsArg);
console.log("seed sha256:", sha(seed));
console.log("pool sha256:", sha(poolText), `(${pool.length} entries)`);
console.log("\nWinners:");
arr.slice(0, w).forEach((e, i) => console.log(`  ${i + 1}. @${e.split(":").slice(1).join(":")}`));
if (b) {
  console.log("Backups:");
  arr.slice(w, w + b).forEach((e, i) => console.log(`  ${i + 1}. @${e.split(":").slice(1).join(":")}`));
}
