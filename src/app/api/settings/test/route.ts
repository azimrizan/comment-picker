import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { getAccount, recentMedia } from "@/lib/instagram";

export const POST = handle(async () => {
  const account = await getAccount();
  const media = await recentMedia();
  return NextResponse.json({ account, recent: media.data });
});
