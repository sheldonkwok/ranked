// Shared helper for applying a *prefix* of the migrations folder, used by the platforms
// backfill (scripts/backfill-platforms.ts) so it can stop right after the table-creation
// migration and before the one that drops the old jsonb column.
import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { Db } from "../src/db";

/**
 * Applies migrations from `folder` up to and including `throughTag` (e.g. "0004_familiar_firelord");
 * applies all of them when `throughTag` is omitted. Mirrors drizzle's own `migrate()`
 * (drizzle-orm/{pglite,postgres-js}/migrator.js), which is just
 * `db.dialect.migrate(readMigrationFiles(config), db.session, config)` — `dialect` and
 * `session` are `@internal` constructor params (not in the public .d.ts) but are real
 * instance properties at runtime, hence the cast.
 */
export async function migrateUpTo(db: Db, folder: string, throughTag?: string): Promise<void> {
  const config = { migrationsFolder: folder };
  const migrations = readMigrationFiles(config);

  let cutoff = migrations.length;
  if (throughTag !== undefined) {
    const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, "utf-8")) as {
      entries: { tag: string }[];
    };
    const idx = journal.entries.findIndex((entry) => entry.tag === throughTag);
    if (idx === -1) {
      throw new Error(`migrateUpTo: no migration tagged "${throughTag}" in ${folder}/meta/_journal.json`);
    }
    cutoff = idx + 1;
  }

  const internal = db as unknown as {
    dialect: { migrate: (m: unknown, s: unknown, c: unknown) => Promise<void> };
    session: unknown;
  };
  await internal.dialect.migrate(migrations.slice(0, cutoff), internal.session, config);
}
