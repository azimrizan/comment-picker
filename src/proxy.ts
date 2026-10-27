import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, safeEqual, SESSION_COOKIE, sessionToken } from "@/lib/auth";

const PUBLIC = ["/login", "/api/login"];

export function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, sessionToken())) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
