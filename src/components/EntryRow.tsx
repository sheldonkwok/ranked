import Image from "next/image";
import { coverUrl } from "@/lib/cover";
import type { Tier } from "@/db/schema";
import ScoreBadge from "@/components/ScoreBadge";

export type EntryRowProps = {
  rank: number;
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
  score: number;
  tier: Tier;
};

export default function EntryRow({
  rank,
  name,
  coverImageId,
  releaseYear,
  score,
  tier,
}: EntryRowProps) {
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
        {rank}
      </span>

      {coverImageId ? (
        <Image
          src={coverUrl(coverImageId, "cover_small")}
          alt=""
          width={40}
          height={53}
          className="h-[53px] w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-[53px] w-10 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        {releaseYear !== null && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{releaseYear}</p>
        )}
      </div>

      <ScoreBadge score={score} tier={tier} />
    </li>
  );
}
