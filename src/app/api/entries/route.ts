import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { serializeEntries } from "@/app/api/_lib/entries";
import { badRequest, withErrorHandling } from "@/app/api/_lib/handler";
import { entries, games, getDb, type Tier } from "@/db";
import { getGameByIgdbId, type IgdbGame } from "@/lib/igdb";
import { getRankedEntries, getTierEntries, insertEntry } from "@/lib/ranking";
import { requireUser } from "@/lib/session";

const VALID_TIERS: readonly Tier[] = ["liked", "fine", "disliked"];

function isTier(value: string): value is Tier {
  return (VALID_TIERS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    const db = await getDb();

    const tierParam = request.nextUrl.searchParams.get("tier");

    if (tierParam === null) {
      const ranked = await getRankedEntries(db, user.id);
      return NextResponse.json({ entries: serializeEntries(ranked) });
    }

    if (!isTier(tierParam)) {
      throw badRequest(`invalid tier "${tierParam}"`);
    }

    const excludeParam = request.nextUrl.searchParams.get("exclude");
    let excludeEntryId: number | undefined;
    if (excludeParam !== null) {
      if (!/^-?\d+$/.test(excludeParam)) {
        throw badRequest("exclude must be an integer entry id");
      }
      excludeEntryId = Number(excludeParam);
    }

    const tierEntries = await getTierEntries(
      db,
      user.id,
      tierParam,
      excludeEntryId
    );
    return NextResponse.json({ entries: serializeEntries(tierEntries) });
  });
}

type CreateEntryBody = {
  igdbId: number;
  tier: Tier;
  position: number;
};

function parseCreateBody(body: unknown): CreateEntryBody {
  if (typeof body !== "object" || body === null) {
    throw badRequest("request body must be a JSON object");
  }

  const { igdbId, tier, position } = body as Record<string, unknown>;

  if (typeof igdbId !== "number" || !Number.isInteger(igdbId) || igdbId <= 0) {
    throw badRequest("igdbId must be a positive integer");
  }
  if (typeof tier !== "string" || !isTier(tier)) {
    throw badRequest(`invalid tier "${String(tier)}"`);
  }
  if (
    typeof position !== "number" ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    throw badRequest("position must be a non-negative integer");
  }

  return { igdbId, tier, position };
}

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw badRequest("request body must be valid JSON");
    }
    const { igdbId, tier, position } = parseCreateBody(rawBody);

    let igdbGame: IgdbGame | null;
    try {
      igdbGame = await getGameByIgdbId(igdbId);
    } catch (err) {
      console.error("IGDB lookup failed:", err);
      return NextResponse.json({ error: "igdb_unavailable" }, { status: 502 });
    }

    if (!igdbGame) {
      return NextResponse.json({ error: "game_not_found" }, { status: 404 });
    }

    const db = await getDb();

    let alreadyRanked = false;
    await db.transaction(async (tx) => {
      const [game] = await tx
        .insert(games)
        .values({
          igdbId: igdbGame.igdbId,
          name: igdbGame.name,
          coverImageId: igdbGame.coverImageId,
          firstReleaseDate: igdbGame.firstReleaseDate,
          platforms: igdbGame.platforms,
          summary: igdbGame.summary,
        })
        .onConflictDoUpdate({
          target: games.igdbId,
          set: {
            name: igdbGame.name,
            coverImageId: igdbGame.coverImageId,
            firstReleaseDate: igdbGame.firstReleaseDate,
            platforms: igdbGame.platforms,
            summary: igdbGame.summary,
          },
        })
        .returning();

      const [existing] = await tx
        .select({ id: entries.id })
        .from(entries)
        .where(and(eq(entries.userId, user.id), eq(entries.gameId, game.id)))
        .limit(1);

      if (existing) {
        alreadyRanked = true;
        return;
      }

      await insertEntry(tx, user.id, game.id, tier, position);
    });

    if (alreadyRanked) {
      return NextResponse.json({ error: "already_ranked" }, { status: 409 });
    }

    const ranked = await getRankedEntries(db, user.id);
    return NextResponse.json(
      { entries: serializeEntries(ranked) },
      { status: 201 }
    );
  });
}
