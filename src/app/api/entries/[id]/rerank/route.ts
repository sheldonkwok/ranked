import { type NextRequest, NextResponse } from "next/server";
import { serializeEntries } from "@/app/api/_lib/entries";
import { isEntryNotFoundError, parseEntryId } from "@/app/api/_lib/entry-id";
import { badRequest, withErrorHandling } from "@/app/api/_lib/handler";
import { getDb, type Tier } from "@/db";
import { getRankedEntries, moveEntry } from "@/lib/ranking";
import { requireUser } from "@/lib/session";

const VALID_TIERS: readonly Tier[] = ["liked", "fine", "disliked"];

function isTier(value: unknown): value is Tier {
  return (
    typeof value === "string" &&
    (VALID_TIERS as readonly string[]).includes(value)
  );
}

type RerankBody = {
  tier: Tier;
  position: number;
};

function parseRerankBody(body: unknown): RerankBody {
  if (typeof body !== "object" || body === null) {
    throw badRequest("request body must be a JSON object");
  }

  const { tier, position } = body as Record<string, unknown>;

  if (!isTier(tier)) {
    throw badRequest(`invalid tier "${String(tier)}"`);
  }
  if (
    typeof position !== "number" ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    throw badRequest("position must be a non-negative integer");
  }

  return { tier, position };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    const { id } = await params;
    const entryId = parseEntryId(id);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw badRequest("request body must be valid JSON");
    }
    const { tier, position } = parseRerankBody(rawBody);

    const db = await getDb();

    try {
      await db.transaction((tx) =>
        moveEntry(tx, user.id, entryId, tier, position)
      );
    } catch (err) {
      if (isEntryNotFoundError(err)) {
        return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
      }
      throw err;
    }

    const ranked = await getRankedEntries(db, user.id);
    return NextResponse.json({ entries: serializeEntries(ranked) });
  });
}
