import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";

/**
 * Union of the two drizzle database flavors we support:
 *  - PgliteDatabase, backed by a file-persisted PGlite instance, for local dev
 *  - PostgresJsDatabase, backed by postgres-js, for prod (Supabase Postgres)
 *
 * Both extend PgDatabase with a different QueryResultHKT, so we keep them as
 * a union rather than trying to force a single generic type. Callers that
 * only use the common Drizzle query builder API (select/insert/update/delete/
 * transaction) work fine against this union.
 */
export type Db = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;

/**
 * Shared transaction type, derived structurally from Db['transaction'] so it
 * stays in sync with whichever driver is active at runtime. Verified to
 * typecheck against both drivers (see scripts/db-check.ts usage during
 * development).
 */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

declare global {
  var __rankedDbInstance: Db | undefined;
  var __rankedDbInitPromise: Promise<Db> | undefined;
}

/**
 * Where the local PGlite instance persists its files when POSTGRES_URL is
 * unset.
 *
 * - Local dev: a repo-relative `./dev-db` dir (git-ignored, survives restarts).
 * - Serverless (e.g. Vercel preview): the app's working directory is
 *   `/var/task`, which is read-only, so a relative dir fails at write time.
 *   Fall back to the OS temp dir (`/tmp`, the one writable location). Data
 *   there is ephemeral — reset on cold start and not shared across instances —
 *   which is fine for throwaway previews. Set POSTGRES_URL to get a real,
 *   persistent Postgres instead.
 *
 * `PGLITE_DATA_DIR` overrides both if you need a specific path.
 */
function pgliteDataDir(): string {
  if (process.env.PGLITE_DATA_DIR) return process.env.PGLITE_DATA_DIR;
  if (process.env.VERCEL) return join(tmpdir(), "ranked-db");
  return "./dev-db";
}

async function initDb(): Promise<Db> {
  const databaseUrl = process.env.POSTGRES_URL;

  if (databaseUrl) {
    const client = postgres(databaseUrl, { prepare: false });
    return drizzlePostgres(client, { schema });
  }

  const db = drizzlePglite({
    connection: { dataDir: pgliteDataDir() },
    schema,
  });

  await migratePglite(db, { migrationsFolder: "./drizzle" });

  return db;
}

/**
 * Returns the singleton database instance, running local-dev migrations on
 * first access. The instance and its init promise are cached on globalThis
 * so that Next.js dev-server HMR (which re-evaluates this module on every
 * edit) doesn't spin up a second PGlite pointing at the same dataDir --
 * PGlite only supports a single process/instance per data directory.
 */
export function getDb(): Promise<Db> {
  if (globalThis.__rankedDbInstance) {
    return Promise.resolve(globalThis.__rankedDbInstance);
  }

  if (!globalThis.__rankedDbInitPromise) {
    globalThis.__rankedDbInitPromise = initDb().then((db) => {
      globalThis.__rankedDbInstance = db;
      return db;
    });
  }

  return globalThis.__rankedDbInitPromise;
}
