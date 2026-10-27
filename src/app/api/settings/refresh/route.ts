import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { refreshLongLivedToken } from "@/lib/instagram";

export const POST = handle(async () => NextResponse.json(await refreshLongLivedToken()));
