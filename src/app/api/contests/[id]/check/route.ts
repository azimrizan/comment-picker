import { NextResponse } from "next/server";
import { runChecks } from "@/lib/evaluate";
import { getContest } from "@/lib/contests";
import { contestId, handle, HttpError, type IdParams } from "@/lib/http";

// Checking thousands of comments (plus optional AI reads) can take a while.
export const maxDuration = 300;

export const POST = handle(async (_req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  if ((await getContest(id))?.fetch_status === "running") throw new HttpError("Wait for the comment fetch to finish first.", 409);
  return NextResponse.json(await runChecks(id));
});
