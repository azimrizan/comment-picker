import { NextResponse } from "next/server";
import { startFetch } from "@/lib/fetchJob";
import { contestId, handle, HttpError, type IdParams } from "@/lib/http";

export const POST = handle(async (req: Request, ctx: IdParams) => {
  const id = await contestId(ctx);
  const { resume } = (await req.json().catch(() => ({}))) as { resume?: boolean };
  try {
    await startFetch(id, Boolean(resume));
  } catch (e) {
    throw new HttpError((e as Error).message, 409);
  }
  return NextResponse.json({ ok: true });
});
