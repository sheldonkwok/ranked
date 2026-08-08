// One-shot platforms backfill. Applies migrations only through THROUGH_TAG (the migration
// that creates `platforms`/`game_platforms` but keeps `games.platforms` — see migrate-to.ts),
// seeds `platforms` from IGDB, and links every game's existing games.platforms jsonb array
// against it. Deliberately does NOT apply the migration that drops games.platforms, so the
// summary below is inspectable before that irreversible step.
//
// Usage: tsx --env-file=.env scripts/backfill-platforms.ts
// Stop `next dev` first — PGlite allows only one process per data dir.
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "../src/db";
import * as schema from "../src/db/schema";
import { getAllPlatforms } from "../src/lib/igdb";
import { migrateUpTo } from "./migrate-to";

// Must match the tag in drizzle/meta/_journal.json for the migration that adds
// platforms/game_platforms while games.platforms still exists. Update if 0004 is regenerated.
const THROUGH_TAG = "0004_familiar_firelord";

async function main() {
  const databaseUrl = process.env.POSTGRES_URL;

  let pgClient: ReturnType<typeof postgres> | null = null;
  let pgliteClient: PGlite | null = null;
  let db: Db;

  if (databaseUrl) {
    pgClient = postgres(databaseUrl, { max: 1, prepare: false });
    db = drizzlePostgres(pgClient, { schema });
  } else {
    pgliteClient = new PGlite("./dev-db");
    db = drizzlePglite(pgliteClient, { schema });
  }

  // `games.platforms` is a raw jsonb column the current schema.ts no longer declares (0005
  // drops it, applied after this script), so touching it has to go through the driver
  // directly rather than drizzle's typed query builder.
  async function rawRows<T extends Record<string, unknown>>(query: string): Promise<T[]> {
    if (pgClient) return pgClient.unsafe(query) as unknown as Promise<T[]>;
    return (await pgliteClient?.query<T>(query))?.rows ?? [];
  }

  console.log(`Applying migrations through ${THROUGH_TAG}...`);
  await migrateUpTo(db, "./drizzle", THROUGH_TAG);

  console.log("Fetching platform list from IGDB...");
  const igdbPlatforms = await getAllPlatforms();
  console.log(`  ${igdbPlatforms.length} platforms`);

  await db
    .insert(schema.platforms)
    .values(igdbPlatforms.map((p) => ({ igdbId: p.igdbId, name: p.name, abbreviation: p.abbreviation })))
    .onConflictDoUpdate({
      target: schema.platforms.igdbId,
      set: { name: sql`excluded.name`, abbreviation: sql`excluded.abbreviation` },
    });

  const [{ total }] = await rawRows<{ total: string }>(
    "select coalesce(sum(jsonb_array_length(platforms)), 0)::text as total from games where platforms is not null"
  );

  console.log("Linking games to platforms by abbreviation (lowest igdb_id wins on a tie)...");
  await rawRows(`
    insert into game_platforms (game_id, platform_id)
    select distinct g.id, p.id
    from games g
    cross join lateral jsonb_array_elements_text(g.platforms) as abbr(value)
    join lateral (
      select pl.id from platforms pl
      where pl.abbreviation = abbr.value
      order by pl.igdb_id
      limit 1
    ) p on true
    where g.platforms is not null and jsonb_typeof(g.platforms) = 'array'
    on conflict do nothing
  `);

  const [{ count: linkCount }] = await rawRows<{ count: string }>("select count(*)::text as count from game_platforms");
  const unmatched = await rawRows<{ abbreviation: string }>(`
    select distinct abbr.value as abbreviation
    from games g, jsonb_array_elements_text(g.platforms) as abbr(value)
    where g.platforms is not null and jsonb_typeof(g.platforms) = 'array'
      and not exists (select 1 from platforms pl where pl.abbreviation = abbr.value)
  `);

  console.log("\nBackfill summary:");
  console.log(`  game_platforms rows: ${linkCount}`);
  console.log(`  jsonb abbreviation entries across games.platforms: ${total}`);
  console.log(
    unmatched.length > 0
      ? `  unmatched abbreviations (dropped, same as the old jsonb behavior): ${unmatched.map((r) => r.abbreviation).join(", ")}`
      : "  no unmatched abbreviations"
  );
  console.log(
    "\nNext: compare the numbers above against your own snapshot of games.platforms, then " +
      "apply the migration that drops the column — start `next dev` locally (auto-migrates), " +
      "or run `pnpm db:migrate:prod` in prod."
  );

  if (pgClient) await pgClient.end();
  if (pgliteClient) await pgliteClient.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
