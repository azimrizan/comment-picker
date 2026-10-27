import { NextResponse } from "next/server";
import { authEnabled, safeEqual, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";

export const POST = handle(async (req: Request) => {
  if (!authEnabled()) return NextResponse.json({ ok: true });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  // Compare HMACs so the check takes the same time whatever was typed.
  if (!password || !safeEqual(sessionToken(password), sessionToken())) throw new HttpError("Wrong password.", 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});

export const DELETE = handle(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
