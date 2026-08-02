import CoverImage from "@/components/CoverImage";
import EntryActions from "@/components/EntryActions";
import ScoreBadge from "@/components/ScoreBadge";
import type { Tier } from "@/db/schema";

export type EntryRowProps = {
  id: number;
  rank: number;
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
  score: number | null;
  tier: Tier;
};

export default function EntryRow({ id, rank, name, coverImageId, releaseYear, score, tier }: EntryRowProps) {
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">{rank}</span>

      <CoverImage
        coverImageId={coverImageId}
        size="cover_small"
        width={40}
        height={53}
        className="h-[53px] w-10 shrink-0 rounded"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        {releaseYear !== null && <p className="text-sm text-zinc-500 dark:text-zinc-400">{releaseYear}</p>}
      </div>

      <ScoreBadge score={score} tier={tier} />

      <EntryActions entryId={id} game={{ name, coverImageId, releaseYear }} tier={tier} />
    </li>
  );
}
