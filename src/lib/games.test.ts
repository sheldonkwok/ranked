import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import { upsertGame, upsertGames } from "./games";
import type { IgdbGame } from "./igdb";

type TestDb = PgliteDatabase<typeof schema>;

let client: PGlite;
let db: TestDb;

function makeIgdbGame(overrides: Partial<IgdbGame> = {}): IgdbGame {
  return {
    igdbId: 1,
    name: "Hollow Knight",
    coverImageId: "co1abc",
    firstReleaseDate: new Date("2017-02-24T00:00:00.000Z"),
    platforms: ["PC"],
    summary: "A metroidvania.",
    totalRatingCount: 100,
    ...overrides,
  };
}

async function findByIgdbId(igdbId: number) {
  const [row] = await db.select().from(schema.games).where(eq(schema.games.igdbId, igdbId));
  return row;
}

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterEach(async () => {
  await client.close();
});

describe("upsertGame / upsertGames", () => {
  it("inserts a new row, optionally carrying a steamAppId", async () => {
    const row = await upsertGame(db, makeIgdbGame());
    expect(row.igdbId).toBe(1);
    expect(row.name).toBe("Hollow Knight");
    expect(row.steamAppId).toBeNull();

    const [withAppId] = await upsertGames(db, [{ game: makeIgdbGame({ igdbId: 2 }), steamAppId: 367520 }]);
    expect(withAppId.steamAppId).toBe(367520);
  });

  it("re-upserting the same igdbId updates metadata rather than duplicating the row", async () => {
    await upsertGame(db, makeIgdbGame());
    await upsertGame(db, makeIgdbGame({ name: "Hollow Knight: Voidheart Edition", summary: "Updated summary." }));

    const rows = await db.select().from(schema.games).where(eq(schema.games.igdbId, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Hollow Knight: Voidheart Edition");
    expect(rows[0].summary).toBe("Updated summary.");
  });

  it("upserting without a steamAppId leaves an existing steam_app_id intact", async () => {
    await upsertGames(db, [{ game: makeIgdbGame(), steamAppId: 367520 }]);

    // Simulates the search-add path (POST /api/entries), which never
    // supplies a steamAppId — it must not wipe out the cached one.
    await upsertGame(db, makeIgdbGame({ summary: "Refreshed via search." }));

    const row = await findByIgdbId(1);
    expect(row.steamAppId).toBe(367520);
    expect(row.summary).toBe("Refreshed via search.");
  });

  it("attaches a steamAppId to a row that was previously added via search", async () => {
    await upsertGame(db, makeIgdbGame());
    expect((await findByIgdbId(1)).steamAppId).toBeNull();

    await upsertGames(db, [{ game: makeIgdbGame(), steamAppId: 367520 }]);
    expect((await findByIgdbId(1)).steamAppId).toBe(367520);
  });

  it("returns an empty array without touching the db for an empty batch", async () => {
    const result = await upsertGames(db, []);
    expect(result).toEqual([]);
  });
});
