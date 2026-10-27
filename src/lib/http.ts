import { NextResponse } from "next/server";
import { IgError } from "./instagram";
import { ValidationError } from "./evaluate";
import { FollowersParseError } from "./followers";

export type IdParams = { params: Promise<{ id: string }> };

export async function contestId(ctx: IdParams) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw new HttpError("Bad contest id", 400);
  return id;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ValidationError) return NextResponse.json({ error: e.message, errors: e.errors }, { status: 400 });
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof IgError || e instanceof FollowersParseError)
        return NextResponse.json({ error: e.message }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: (e as Error).message ?? "Server error" }, { status: 500 });
    }
  };
}
