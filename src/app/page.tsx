import Link from "next/link";
import { redirect } from "next/navigation";
import RankedList from "@/components/RankedList";
import Toast from "@/components/Toast";
import { getDb } from "@/db";
import { getRankedEntries } from "@/lib/ranking";
import { getCurrentUser } from "@/lib/session";

const RANKED_SCORE_PATTERN = /^\d{1,2}\.\d$/;

type HomePageProps = {
  searchParams: Promise<{ ranked?: string }>;
};

function toastMessage(ranked: string | undefined): string | null {
  if (ranked === undefined) return null;
  if (ranked === "hidden") return "RANKED!";
  if (RANKED_SCORE_PATTERN.test(ranked)) return `RANKED! ${ranked}`;
  return null;
}

export default async function Home({ searchParams }: HomePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const db = await getDb();
  const entries = await getRankedEntries(db, user.id);
  const { ranked } = await searchParams;
  const toast = toastMessage(ranked);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-16 text-center">
        <div className="pixel-panel px-12 py-10 text-[14px] tracking-[1px] text-ink-faint">NO GAMES RANKED YET</div>
        <Link href="/add" className="pixel-btn-gold">
          RANK A GAME
        </Link>
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[22px] flex items-end justify-between gap-5">
        <div>
          <h1 className="pixel-heading mb-3 text-[22px]">MY RANKED GAMES</h1>
          <p className="pixel-text-shadow text-[13px] tracking-[1px] text-ink">
            {entries.length} {entries.length === 1 ? "GAME" : "GAMES"} &nbsp;·&nbsp; BEST TO WORST
          </p>
        </div>
        <Link href="/add" className="pixel-btn-gold">
          RANK A GAME
        </Link>
      </div>
      <RankedList entries={entries} />
      {toast && <Toast message={toast} />}
    </div>
  );
}
