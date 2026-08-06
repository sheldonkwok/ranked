import Link from "next/link";
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

// The cover + title, shared between the read-only `<div>` and the linked
// `<a>` wrapping it below so both variants share the same markup/geometry.
function EntryCoverAndTitle({
  coverImageId,
  name,
  releaseYear,
}: {
  coverImageId: string | null;
  name: string;
  releaseYear: number | null;
}) {
  return (
    <>
      <CoverImage
        coverImageId={coverImageId}
        size="cover_small"
        width={42}
        height={56}
        className="entry-cover shrink-0 border border-edge/45"
      />
      <div className="entry-title min-w-0">
        <p className="entry-name text-ink" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}>
          {name}
        </p>
        {releaseYear !== null && <p className="entry-year tracking-[1px] text-ink-dim">{releaseYear}</p>}
      </div>
    </>
  );
}

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
    <li className="entry-row-grid pixel-row items-center">
      <span
        className="entry-rank font-pixel text-center text-gold-bright"
        style={{ textShadow: "0 2px 3px rgba(0,0,0,0.9)" }}
      >
        {String(rank).padStart(2, "0")}
      </span>

      {readOnly ? (
        <div className="entry-link">
          <EntryCoverAndTitle coverImageId={coverImageId} name={name} releaseYear={releaseYear} />
        </div>
      ) : (
        <Link
          href={`/add?related=${encodeURIComponent(name)}`}
          className="entry-link"
          aria-label={`Find games like ${name}`}
        >
          <EntryCoverAndTitle coverImageId={coverImageId} name={name} releaseYear={releaseYear} />
        </Link>
      )}

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
