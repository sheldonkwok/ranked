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
    <li className="entry-row-grid pixel-row items-center p-[12px_14px]">
      <span
        className="entry-rank font-pixel text-center text-[14px] text-gold-bright"
        style={{ textShadow: "0 2px 3px rgba(0,0,0,0.9)" }}
      >
        {String(rank).padStart(2, "0")}
      </span>

      <CoverImage
        coverImageId={coverImageId}
        size="cover_small"
        width={42}
        height={56}
        className="entry-cover h-14 w-[42px] shrink-0 border border-edge/45"
      />

      <div className="entry-title min-w-0">
        <p
          className="truncate text-[17px] tracking-[0.5px] text-ink"
          style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
        >
          {name}
        </p>
        {releaseYear !== null && <p className="text-[12px] tracking-[1px] text-ink-dim">{releaseYear}</p>}
      </div>

      <div className="entry-meta flex items-center gap-3">
        <ScoreBadge score={score} tier={tier} />
        <EntryActions entryId={id} game={{ name, coverImageId, releaseYear }} tier={tier} />
      </div>
    </li>
  );
}
