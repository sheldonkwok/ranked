// Shared helpers for JSON API route handlers under src/app/api.
//
// Every route wraps its logic in `withErrorHandling`, which maps the two
// "expected" failure modes callers throw/return to consistent JSON
// responses (401 for unauthenticated requests, and any explicit
// `ApiError` a handler throws for validation/not-found/upstream failures),
// and otherwise logs + 500s so unexpected bugs don't leak internals to
// clients.
import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/session";

/** Thrown by route handlers to short-circuit with a specific status + JSON error body. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "api_error");
    this.status = status;
    this.body = body;
  }
}

/** 400 with `{ error: message }`. */
export function badRequest(message: string): ApiError {
  return new ApiError(400, { error: message });
}

/** Wraps a route handler body, translating known errors into JSON responses. */
export async function withErrorHandling(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (err instanceof ApiError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    console.error("Unhandled API error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

/** Best-effort year extraction, for the client-facing `releaseYear` convenience field. */
export function releaseYearOf(date: Date | null): number | null {
  return date ? date.getUTCFullYear() : null;
}
