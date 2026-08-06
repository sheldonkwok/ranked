import { entryCover, entryLink, entryRank, entryRowGrid } from "@/components/entryRowStyles";
import { panel } from "@/components/ui/surface";

const SKELETON_ROW_COUNT = 8;

export default function Loading() {
  return (
    <ol className={panel({ className: "p-1.5" })}>
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: static-length anonymous placeholder list, never reordered
          key={i}
          className={`${entryRowGrid} items-center border-b border-edge/12`}
        >
          <span className={`${entryRank} cover-hatch h-7 w-full shrink-0 animate-pulse`} />
          {/* `entryCover` carries its own width/height per breakpoint
              (entryRowStyles.ts), so this skeleton tracks EntryRow's cover
              size at every width without duplicating the numbers here. Cover
              + title share one grid cell (`entryLink`), same as EntryRow, so
              the score chip placeholder below stays in its own column
              instead of wrapping to a new row. */}
          <div className={entryLink}>
            <span className={`${entryCover} cover-hatch shrink-0 animate-pulse`} />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="cover-hatch h-4 w-2/3 animate-pulse" />
              <span className="cover-hatch h-3 w-10 animate-pulse" />
            </div>
          </div>
          {/* Matches the score chip's rendered box. */}
          <span className="h-[33px] w-[66px] shrink-0 cover-hatch animate-pulse mobile:h-[46px] mobile:w-[62px] mobile-xs:h-[46px] mobile-xs:w-[54px]" />
        </li>
      ))}
    </ol>
  );
}
