import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import AddFlow from "./AddFlow";

export const metadata: Metadata = {
  title: "Add a game",
};

type AddPageProps = {
  searchParams: Promise<{ related?: string }>;
};

export default async function AddPage({ searchParams }: AddPageProps) {
  const user = await getCurrentUser();
  const { related } = await searchParams;

  return (
    <div className="mx-auto flex max-w-[660px] flex-col gap-5">
      <h1 className="pixel-heading text-[18px]">ADD A GAME</h1>
      <AddFlow steamLinked={Boolean(user?.steamId)} relatedTo={related?.trim() || null} />
    </div>
  );
}
