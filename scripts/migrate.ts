// Usage: tsx --env-file=.env scripts/migrate.ts [--to <tag>]
// `--to` applies migrations only up through the given tag (see migrateUpTo in migrate-to.ts) —
// used for the platforms backfill, which must stop before the migration that drops
// games.platforms so the backfill script can still read it.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { migrateUpTo } from "./migrate-to";

async function main() {
  const databaseUrl = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is required to run production migrations");
  }

  const toFlagIndex = process.argv.indexOf("--to");
  const throughTag = toFlagIndex !== -1 ? process.argv[toFlagIndex + 1] : undefined;
  if (toFlagIndex !== -1 && !throughTag) {
    throw new Error("--to requires a migration tag, e.g. --to 0004_familiar_firelord");
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  console.log(throughTag ? `Running migrations through ${throughTag}...` : "Running migrations...");
  await migrateUpTo(db, "./drizzle", throughTag);
  console.log("Migrations complete.");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
