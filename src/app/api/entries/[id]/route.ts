import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { getRankedEntries, removeEntry } from "@/lib/ranking";
import { withErrorHandling } from "@/app/api/_lib/handler";
import { serializeEntries } from "@/app/api/_lib/entries";
import { isEntryNotFoundError, parseEntryId } from "@/app/api/_lib/entry-id";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    const { id } = await params;
    const entryId = parseEntryId(id);

    const db = await getDb();

    try {
      await db.transaction((tx) => removeEntry(tx, user.id, entryId));
    } catch (err) {
      if (isEntryNotFoundError(err)) {
        return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
      }
      throw err;
    }

    const ranked = await getRankedEntries(db, user.id);
    return NextResponse.json({ ok: true, entries: serializeEntries(ranked) });
  });
}
