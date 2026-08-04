import CoverImage from "@/components/CoverImage";
import ScoreButton from "@/components/ScoreButton";
import ScoreChip from "@/components/ScoreChip";
import type { Tier } from "@/db/schema";

export type EntryRowProps = {
  id: number;
  rank: number;
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
  score: number | null;
  tier: Tier;
  /** Read-only rows (public profiles) render a static chip instead of the edit trigger. */
  readOnly?: boolean;
};

export default function EntryRow({
  id,
  rank,
  name,
  coverImageId,
  releaseYear,
  score,
  tier,
  readOnly = false,
}: EntryRowProps) {
  return (
    <li className="entry-row-grid pixel-row items-center p-[12px_18px]">
      <span
        className="entry-rank font-pixel text-center text-[28px] text-gold-bright"
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
        {releaseYear !== null && <p className="text-[16px] tracking-[1px] text-ink-dim">{releaseYear}</p>}
      </div>

      <div className="entry-meta flex items-center">
        {readOnly ? (
          <ScoreChip tier={tier} score={score} />
        ) : (
          <ScoreButton entryId={id} game={{ name, coverImageId, releaseYear }} tier={tier} score={score} />
        )}
      </div>
    </li>
  );
}
