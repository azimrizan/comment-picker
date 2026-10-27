import { NextResponse } from "next/server";
import { fetchStep } from "@/lib/fetchJob";
import { contestId, handle, type IdParams } from "@/lib/http";

// Each step works for ~40s, then returns so the browser can call again.
export const maxDuration = 60;

export const POST = handle(async (_req: Request, ctx: IdParams) => NextResponse.json(await fetchStep(await contestId(ctx))));
