import { NextResponse } from "next/server";
import { getSetting, run, setSetting } from "@/lib/db";
import { handle, HttpError } from "@/lib/http";
import { GRAPH_BASE, IG_USER_ID } from "@/lib/instagram";
import { aiAvailable } from "@/lib/ai";

export const GET = handle(async () => {
  const saved = await getSetting("ig_access_token");
  return NextResponse.json({
    tokenSource: saved ? "saved" : process.env.IG_ACCESS_TOKEN ? "env" : null,
    tokenSavedAt: await getSetting("ig_token_saved_at"),
    tokenRefreshedAt: await getSetting("ig_token_refreshed_at"),
    graphBase: GRAPH_BASE,
    igUserId: IG_USER_ID,
    aiAvailable: aiAvailable(),
  });
});

export const POST = handle(async (req: Request) => {
  const { token: raw } = (await req.json()) as { token?: string };
  // Copying from Meta's dialog can bring along line breaks, quotes or an "access_token=" prefix.
  const token = (raw ?? "").replace(/^access_token=/, "").replace(/[\s"']/g, "");
  if (token.length < 20) throw new HttpError("Paste a valid access token.");
  if (GRAPH_BASE.includes("graph.instagram.com") && !token.startsWith("IG")) {
    throw new HttpError(
      'This doesn\'t look like an Instagram Login token (those start with "IG"). Use Generate token under API setup with Instagram login, not the Graph API Explorer.',
    );
  }
  await setSetting("ig_access_token", token);
  await setSetting("ig_token_saved_at", new Date().toISOString());
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async () => {
  await run("DELETE FROM settings WHERE key IN ('ig_access_token', 'ig_token_saved_at', 'ig_token_refreshed_at')");
  return NextResponse.json({ ok: true });
});
