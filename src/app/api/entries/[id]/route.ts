import { type NextRequest, NextResponse } from "next/server";
import { serializeEntries } from "@/app/api/_lib/entries";
import { isEntryNotFoundError, parseEntryId } from "@/app/api/_lib/entry-id";
import { withErrorHandling } from "@/app/api/_lib/handler";
import { getDb } from "@/db";
import { getRankedEntries, removeEntry } from "@/lib/ranking";
import { requireUser } from "@/lib/session";

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
