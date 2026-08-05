// Small helper for ad-hoc timing of server operations, logged straight to
// stdout — no exporter, no dashboard. Vercel's trace viewer is a paid
// add-on we don't want to depend on; a `console.log` line shows up for free
// in `next dev` output and in Vercel's runtime logs. These always log, in
// every environment (dev, prod, `pnpm test`) — there's no gating.
export type TimingAttributes = Record<string, string | number | boolean>;

export type TimingRecorder = {
  /** Adds (or overwrites) a key/value pair that gets printed alongside the duration. */
  set(key: string, value: string | number | boolean): void;
};

/**
 * Runs `fn`, timing it with `performance.now()`, and logs a single line like
 * `[timing] igdb.search 142ms endpoint=games status=200` once it settles.
 *
 * `fn` receives a recorder so it can add attributes only known partway
 * through (e.g. a result count). On a thrown error the line still logs (with
 * an `error=<name>` attribute) before rethrowing, so failures show up with
 * their duration instead of just disappearing.
 */
export async function withTiming<T>(
  name: string,
  fn: (t: TimingRecorder) => Promise<T>,
  attributes?: TimingAttributes
): Promise<T> {
  const attrs: TimingAttributes = { ...attributes };
  const recorder: TimingRecorder = {
    set(key, value) {
      attrs[key] = value;
    },
  };

  const start = performance.now();
  try {
    return await fn(recorder);
  } catch (err) {
    attrs.error = err instanceof Error ? err.name : String(err);
    throw err;
  } finally {
    const ms = Math.round(performance.now() - start);
    const pairs = Object.entries(attrs)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    console.log(`[timing] ${name} ${ms}ms${pairs ? ` ${pairs}` : ""}`);
  }
}
