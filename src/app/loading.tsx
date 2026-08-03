const SKELETON_ROW_COUNT = 8;

export default function Loading() {
  return (
    <ol className="pixel-panel p-1.5">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: static-length anonymous placeholder list, never reordered
          key={i}
          className="entry-row-grid items-center border-b border-edge/12 p-[12px_18px]"
        >
          <span className="entry-rank cover-hatch h-7 w-8 shrink-0 animate-pulse" />
          <span className="entry-cover cover-hatch h-14 w-[42px] shrink-0 animate-pulse" />
          <div className="entry-title flex min-w-0 flex-col gap-2">
            <span className="cover-hatch h-4 w-2/3 animate-pulse" />
            <span className="cover-hatch h-3 w-10 animate-pulse" />
          </div>
          {/* Matches the score chip's rendered box (66px min-width, ~33px tall). */}
          <span className="entry-meta cover-hatch h-[33px] w-[66px] shrink-0 animate-pulse" />
        </li>
      ))}
    </ol>
  );
}
