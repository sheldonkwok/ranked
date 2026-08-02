import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import {
  TIER_BANDS,
  TIER_ORDER,
  computeScore,
  getRankedEntries,
  getTierEntries,
  insertEntry,
  moveEntry,
  removeEntry,
} from "./ranking";

type TestDb = PgliteDatabase<typeof schema>;

const USER_ID = "test-user";

let client: PGlite;
let db: TestDb;

async function seedGames(names: string[]) {
  return db
    .insert(schema.games)
    .values(names.map((name, i) => ({ igdbId: 1000 + i, name })))
    .returning();
}

/** Reads a tier back in position order, straight from the table. */
async function tierRows(tier: schema.Tier) {
  return db
    .select()
    .from(schema.entries)
    .where(eq(schema.entries.tier, tier))
    .orderBy(asc(schema.entries.position));
}

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });

  await db.insert(schema.users).values({
    id: USER_ID,
    twitchId: "twitch-1",
    username: "tester",
  });
});

afterEach(async () => {
  await client.close();
});

describe("computeScore", () => {
  it("returns the tier's hi bound when count is 1", () => {
    for (const tier of TIER_ORDER) {
      expect(computeScore(0, 1, tier)).toBe(TIER_BANDS[tier].hi);
    }
  });

  it("spreads a 3-entry liked tier across the band with 1-decimal rounding", () => {
    // 10 - 1 * 3.3 / 2 = 8.35 -> rounds to 8.4 (Math.round(83.5) === 84)
    expect(computeScore(0, 3, "liked")).toBe(10.0);
    expect(computeScore(1, 3, "liked")).toBe(8.4);
    expect(computeScore(2, 3, "liked")).toBe(6.7);
  });

  it("hits the tier's lo bound exactly at the last index", () => {
    for (const tier of TIER_ORDER) {
      const { lo } = TIER_BANDS[tier];
      expect(computeScore(4, 5, tier)).toBe(lo);
    }
  });

  it("hits the tier's hi bound exactly at index 0 regardless of count", () => {
    for (const tier of TIER_ORDER) {
      const { hi } = TIER_BANDS[tier];
      expect(computeScore(0, 7, tier)).toBe(hi);
    }
  });

  it("rounds to a single decimal place", () => {
    // fine band: 6.6 - i * 3.2 / 6, i=1 -> 6.6 - 0.5333.. = 6.0666.. -> 6.1
    const score = computeScore(1, 7, "fine");
    expect(score).toBe(6.1);
    expect(Number.isInteger(score * 10)).toBe(true);
  });
});

describe("insertEntry", () => {
  it("inserts into an empty tier at position 0 with the tier's hi score", async () => {
    const [game] = await seedGames(["Solo Game"]);

    await db.transaction(async (tx) => {
      await insertEntry(tx, USER_ID, game.id, "liked", 0);
    });

    const rows = await tierRows("liked");
    expect(rows).toHaveLength(1);
    expect(rows[0].position).toBe(0);
    expect(Number(rows[0].score)).toBe(TIER_BANDS.liked.hi);
  });

  it("inserts at head, middle, and tail and keeps positions dense with recomputed scores", async () => {
    const [g1, g2, g3] = await seedGames(["A", "B", "C"]);

    await db.transaction(async (tx) => {
      await insertEntry(tx, USER_ID, g1.id, "liked", 0); // [A]
      await insertEntry(tx, USER_ID, g2.id, "liked", 0); // [B, A] (head)
      await insertEntry(tx, USER_ID, g3.id, "liked", 1); // [B, C, A] (middle)
    });

    const rows = await tierRows("liked");
    expect(rows.map((r) => r.gameId)).toEqual([g2.id, g3.id, g1.id]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(rows.map((r) => Number(r.score))).toEqual([10.0, 8.4, 6.7]);
  });

  it("clamps an out-of-range position to the tail", async () => {
    const [g1, g2] = await seedGames(["A", "B"]);

    await db.transaction(async (tx) => {
      await insertEntry(tx, USER_ID, g1.id, "fine", 0);
      await insertEntry(tx, USER_ID, g2.id, "fine", 999);
    });

    const rows = await tierRows("fine");
    expect(rows.map((r) => r.gameId)).toEqual([g1.id, g2.id]);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
  });

  it("returns the new entry's id", async () => {
    const [game] = await seedGames(["A"]);

    const id = await db.transaction((tx) =>
      insertEntry(tx, USER_ID, game.id, "disliked", 0)
    );

    const [row] = await db
      .select()
      .from(schema.entries)
      .where(eq(schema.entries.id, id));
    expect(row.gameId).toBe(game.id);
  });
});

describe("moveEntry", () => {
  async function seedLikedTier() {
    const gamesList = await seedGames(["A", "B", "C", "D"]);
    const ids: number[] = [];
    await db.transaction(async (tx) => {
      for (const g of gamesList) {
        ids.push(await insertEntry(tx, USER_ID, g.id, "liked", 0));
      }
    });
    // insertEntry(..., 0) repeatedly prepends, so current order is D, C, B, A
    return { gamesList, ids };
  }

  it("moves an entry down within the same tier and recomputes scores once", async () => {
    const { gamesList } = await seedLikedTier(); // order: D, C, B, A
    const rowsBefore = await tierRows("liked");
    const entryA = rowsBefore.find((r) => r.gameId === gamesList[0].id); // "A", currently last
    if (!entryA) throw new Error("entryA not found in seeded rows");

    // Move A (index 3, excluding itself index range [0,3]) to the front (index 0)
    await db.transaction((tx) => moveEntry(tx, USER_ID, entryA.id, "liked", 0));

    const rows = await tierRows("liked");
    expect(rows.map((r) => r.gameId)).toEqual([
      gamesList[0].id,
      gamesList[3].id,
      gamesList[2].id,
      gamesList[1].id,
    ]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3]);
    expect(rows.map((r) => Number(r.score))).toEqual(
      [0, 1, 2, 3].map((i) => computeScore(i, 4, "liked"))
    );
  });

  it("moves an entry up within the same tier", async () => {
    const { gamesList } = await seedLikedTier(); // order: D, C, B, A
    const rowsBefore = await tierRows("liked");
    const entryD = rowsBefore.find((r) => r.gameId === gamesList[3].id); // "D", currently first
    if (!entryD) throw new Error("entryD not found in seeded rows");

    // Move D (index 0) to the end of the remaining 3-entry list (index 2)
    await db.transaction((tx) => moveEntry(tx, USER_ID, entryD.id, "liked", 2));

    const rows = await tierRows("liked");
    expect(rows.map((r) => r.gameId)).toEqual([
      gamesList[2].id,
      gamesList[1].id,
      gamesList[3].id,
      gamesList[0].id,
    ]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3]);
  });

  it("moves an entry across tiers and recomputes both tiers' scores, closing gaps", async () => {
    const [g1, g2, g3] = await seedGames(["A", "B", "C"]);
    let entryB = 0;

    await db.transaction(async (tx) => {
      await insertEntry(tx, USER_ID, g1.id, "liked", 0);
      entryB = await insertEntry(tx, USER_ID, g2.id, "liked", 1);
      await insertEntry(tx, USER_ID, g3.id, "liked", 2);
    });

    await db.transaction((tx) => moveEntry(tx, USER_ID, entryB, "fine", 0));

    const likedRows = await tierRows("liked");
    const fineRows = await tierRows("fine");

    expect(likedRows.map((r) => r.gameId)).toEqual([g1.id, g3.id]);
    expect(likedRows.map((r) => r.position)).toEqual([0, 1]);
    expect(likedRows.map((r) => Number(r.score))).toEqual([
      computeScore(0, 2, "liked"),
      computeScore(1, 2, "liked"),
    ]);

    expect(fineRows.map((r) => r.gameId)).toEqual([g2.id]);
    expect(fineRows.map((r) => r.position)).toEqual([0]);
    expect(Number(fineRows[0].score)).toBe(TIER_BANDS.fine.hi);
  });

  it("throws when the entry does not belong to the requesting user", async () => {
    const [game] = await seedGames(["A"]);
    const entryId = await db.transaction((tx) =>
      insertEntry(tx, USER_ID, game.id, "liked", 0)
    );

    await expect(
      db.transaction((tx) => moveEntry(tx, "someone-else", entryId, "liked", 0))
    ).rejects.toThrow();
  });
});

describe("removeEntry", () => {
  it("closes the gap and recomputes scores after removing a middle entry", async () => {
    const gamesList = await seedGames(["A", "B", "C"]);
    const ids: number[] = [];

    await db.transaction(async (tx) => {
      for (const g of gamesList) {
        ids.push(await insertEntry(tx, USER_ID, g.id, "liked", ids.length));
      }
    });

    await db.transaction((tx) => removeEntry(tx, USER_ID, ids[1]));

    const rows = await tierRows("liked");
    expect(rows.map((r) => r.gameId)).toEqual([gamesList[0].id, gamesList[2].id]);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
    expect(rows.map((r) => Number(r.score))).toEqual([
      computeScore(0, 2, "liked"),
      computeScore(1, 2, "liked"),
    ]);
  });

  it("leaves an empty tier after removing the last entry", async () => {
    const [game] = await seedGames(["A"]);
    const entryId = await db.transaction((tx) =>
      insertEntry(tx, USER_ID, game.id, "disliked", 0)
    );

    await db.transaction((tx) => removeEntry(tx, USER_ID, entryId));

    const rows = await tierRows("disliked");
    expect(rows).toHaveLength(0);
  });

  it("throws when the entry does not belong to the requesting user", async () => {
    const [game] = await seedGames(["A"]);
    const entryId = await db.transaction((tx) =>
      insertEntry(tx, USER_ID, game.id, "liked", 0)
    );

    await expect(
      db.transaction((tx) => removeEntry(tx, "someone-else", entryId))
    ).rejects.toThrow();
  });
});

describe("getRankedEntries", () => {
  it("orders globally by tier (liked, fine, disliked) then by position", async () => {
    const [liked1, liked2, fine1, disliked1] = await seedGames([
      "Liked1",
      "Liked2",
      "Fine1",
      "Disliked1",
    ]);

    await db.transaction(async (tx) => {
      // Insert out of tier order to prove sorting isn't insertion-order dependent.
      await insertEntry(tx, USER_ID, disliked1.id, "disliked", 0);
      await insertEntry(tx, USER_ID, fine1.id, "fine", 0);
      await insertEntry(tx, USER_ID, liked1.id, "liked", 0);
      await insertEntry(tx, USER_ID, liked2.id, "liked", 1);
    });

    const ranked = await getRankedEntries(db, USER_ID);

    expect(ranked.map((r) => r.game.name)).toEqual([
      "Liked1",
      "Liked2",
      "Fine1",
      "Disliked1",
    ]);
    expect(ranked.every((r) => typeof r.score === "number")).toBe(true);
    expect(ranked.map((r) => r.tier)).toEqual(["liked", "liked", "fine", "disliked"]);
  });
});

describe("getTierEntries", () => {
  it("returns a single tier in position order, optionally excluding one entry", async () => {
    const gamesList = await seedGames(["A", "B", "C"]);
    const ids: number[] = [];

    await db.transaction(async (tx) => {
      for (const g of gamesList) {
        ids.push(await insertEntry(tx, USER_ID, g.id, "fine", ids.length));
      }
    });

    const all = await getTierEntries(db, USER_ID, "fine");
    expect(all.map((r) => r.game.name)).toEqual(["A", "B", "C"]);

    const excluded = await getTierEntries(db, USER_ID, "fine", ids[1]);
    expect(excluded.map((r) => r.game.name)).toEqual(["A", "C"]);
  });
});
