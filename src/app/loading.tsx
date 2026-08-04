const SKELETON_ROW_COUNT = 8;

export default function Loading() {
  return (
    <ol className="pixel-panel p-1.5">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: static-length anonymous placeholder list, never reordered
          key={i}
          className="entry-row-grid items-center border-b border-edge/12"
        >
          {/* `.entry-cover` carries its own width/height per breakpoint
              (globals.css), so this skeleton tracks EntryRow's cover size at
              every width without duplicating the numbers here. The rank
              placeholder has no text to size against, so it just fills its
              grid cell — which the same grid-template-columns narrows on its
              own — at a fixed height. */}
          <span className="entry-rank cover-hatch h-7 w-full shrink-0 animate-pulse" />
          <span className="entry-cover cover-hatch shrink-0 animate-pulse" />
          <div className="entry-title flex min-w-0 flex-col gap-2">
            <span className="cover-hatch h-4 w-2/3 animate-pulse" />
            <span className="cover-hatch h-3 w-10 animate-pulse" />
          </div>
          {/* Matches the score chip's rendered box. */}
          <span className="entry-meta cover-hatch h-[33px] w-[66px] shrink-0 animate-pulse mobile:h-[46px] mobile:w-[62px] mobile-xs:h-[46px] mobile-xs:w-[54px]" />
        </li>
      ))}
    </ol>
  );
}
