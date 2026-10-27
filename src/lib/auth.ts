import { createHmac, timingSafeEqual } from "node:crypto";

// Single shared admin password (ADMIN_PASSWORD). The session cookie is an HMAC of the password,
// so changing the password signs everyone out. With no password set (local use) the app stays open.

export const SESSION_COOKIE = "cp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const authEnabled = () => Boolean(process.env.ADMIN_PASSWORD);

export function sessionToken(password = process.env.ADMIN_PASSWORD ?? "") {
  return createHmac("sha256", password).update("comment-picker-session-v1").digest("hex");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
