import {
  drizzle as drizzlePglite,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
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
export type Db =
  | PgliteDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

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

async function initDb(): Promise<Db> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const client = postgres(databaseUrl, { prepare: false });
    return drizzlePostgres(client, { schema });
  }

  const db = drizzlePglite({
    connection: { dataDir: "./dev-db" },
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
