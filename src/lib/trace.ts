// Small wrapper around the OpenTelemetry API for ad-hoc spans in server code.
//
// Registration lives in `src/instrumentation.ts` (via `@vercel/otel`), which
// only actually exports anywhere when running on Vercel. Off Vercel (local
// dev, `pnpm test`, CI) `trace.getTracer` returns the OTel no-op
// implementation, so every function here is a harmless pass-through — no env
// checks needed at the call sites.
import { type Attributes, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("ranked");

/**
 * Runs `fn` inside a new active span named `name`. Nesting is implicit:
 * calling `withSpan` again inside `fn` parents the inner span under this one
 * via OTel's context propagation.
 *
 * `fn` receives the span so it can call `span.setAttribute(s)` once it knows
 * values only available partway through (e.g. a result count). On a thrown
 * error the exception is recorded and the span is marked errored before it
 * rethrows, so failures show up in the trace instead of just disappearing.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: ReturnType<typeof tracer.startSpan>) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
