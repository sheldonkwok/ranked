import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProfileHeader from "@/components/ProfileHeader";
import RankedList from "@/components/RankedList";
import { panel } from "@/components/ui/surface";
import { getDb } from "@/db";
import { getRankedEntries } from "@/lib/ranking";
import { getUserByUsername } from "@/lib/users";

type PublicRankingPageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: PublicRankingPageProps): Promise<Metadata> {
  const { username } = await params;
  const db = await getDb();
  const profile = await getUserByUsername(db, username);
  if (!profile) return {};

  const name = profile.displayName ?? profile.username;
  return {
    title: name,
    openGraph: {
      title: `${name} — Ranked`,
      description: `See ${name}'s video game ranking.`,
      type: "profile",
    },
  };
}

export default async function PublicRankingPage({ params }: PublicRankingPageProps) {
  const { username } = await params;

  const db = await getDb();
  const profile = await getUserByUsername(db, username);
  if (!profile) {
    notFound();
  }

  const entries = await getRankedEntries(db, profile.id);

  return (
    <>
      <ProfileHeader
        username={profile.username}
        displayName={profile.displayName}
        avatarUrl={profile.avatarUrl}
        gameCount={entries.length}
      />

      {entries.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className={panel({ className: "px-12 py-10 text-[14px] tracking-[1px] text-ink-faint" })}>
            NO GAMES RANKED YET
          </div>
        </div>
      ) : (
        <RankedList entries={entries} readOnly />
      )}
    </>
  );
}
