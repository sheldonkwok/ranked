const SKELETON_ROW_COUNT = 8;

export default function Loading() {
  return (
    <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static-length anonymous placeholder list, never reordered
        <li key={i} className="flex items-center gap-4 py-3">
          <span className="h-4 w-6 shrink-0 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <span className="h-[53px] w-10 shrink-0 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <span className="h-3 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <span className="h-6 w-10 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </li>
      ))}
    </ol>
  );
}
