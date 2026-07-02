import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { getRankedEntries } from "@/lib/ranking";
import RankedList from "@/components/RankedList";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const db = await getDb();
  const entries = await getRankedEntries(db, user.id);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You haven&apos;t ranked any games yet.
        </p>
        <Link
          href="/add"
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add your first game
        </Link>
      </div>
    );
  }

  return <RankedList entries={entries} />;
}
