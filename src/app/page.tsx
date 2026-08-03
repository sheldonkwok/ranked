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
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  return (
    <div>
      <RankedList entries={entries} />
      {toast && <Toast message={toast} />}
    </div>
  );
}
