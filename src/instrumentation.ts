import { registerOTel } from "@vercel/otel";

// Registers the OpenTelemetry SDK. On Vercel this exports spans to Vercel's
// trace viewer (Observability -> Traces) automatically; locally/in tests it
// still runs but with no exporter configured, so `trace.getTracer(...)` spans
// created via `src/lib/trace.ts` are effectively no-ops off Vercel.
export function register() {
  registerOTel({ serviceName: "ranked" });
}
