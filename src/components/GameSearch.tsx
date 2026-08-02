"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CoverImage from "@/components/CoverImage";

export type GameSearchResult = {
  igdbId: number;
  name: string;
  coverImageId: string | null;
  firstReleaseDate: string | null;
  releaseYear: number | null;
  platforms: string[];
  summary: string;
  alreadyRanked: boolean;
};

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; results: GameSearchResult[] };

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 5;

export default function GameSearch({
  onSelectAction,
}: {
  onSelectAction: (game: GameSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();

  const runSearch = useCallback(async (trimmed: string) => {
    const requestId = ++requestIdRef.current;
    setState({ kind: "loading" });

    try {
      const res = await fetch(
        `/api/games/search?q=${encodeURIComponent(trimmed)}`
      );

      if (requestId !== requestIdRef.current) return;

      if (res.status === 502) {
        setState({
          kind: "error",
          message:
            "Game search is unavailable (IGDB credentials not configured).",
        });
        return;
      }

      if (!res.ok) {
        setState({
          kind: "error",
          message: "Something went wrong searching for games. Try again.",
        });
        return;
      }

      const data = (await res.json()) as { results: GameSearchResult[] };
      if (requestId !== requestIdRef.current) return;
      setState({ kind: "results", results: data.results });
    } catch {
      if (requestId !== requestIdRef.current) return;
      setState({
        kind: "error",
        message: "Something went wrong searching for games. Try again.",
      });
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    // Too short to search: leave any prior search state untouched (it's
    // simply not rendered below while the query is short) rather than
    // resetting it synchronously here.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    // Hold the timer in a local so the cleanup cancels *this* effect's timer
    // rather than whatever happens to be in the ref by then. The ref exists
    // only so `handleSubmit` can cancel a still-pending debounce.
    const timer = setTimeout(() => {
      debounceRef.current = null;
      runSearch(trimmed);
    }, DEBOUNCE_MS);
    debounceRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (debounceRef.current === timer) {
        debounceRef.current = null;
      }
    };
  }, [query, runSearch]);

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    runSearch(trimmedQuery);
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a game…"
          autoFocus
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        <p className="text-xs text-zinc-500">
          Results appear as you type — press Enter to search now.
        </p>
      </form>

      {trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH && (
        <p className="text-sm text-zinc-500">
          Keep typing ({MIN_QUERY_LENGTH}+ characters)…
        </p>
      )}

      {/* Once the query drops below the minimum length, the effect stops
          updating `state`, so we gate all of its branches on the current
          query length here rather than resetting state synchronously. */}
      {trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "loading" && (
        <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300"
          />
          Searching…
        </div>
      )}

      {trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "error" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {state.message}
        </p>
      )}

      {trimmedQuery.length >= MIN_QUERY_LENGTH &&
        state.kind === "results" &&
        state.results.length === 0 && (
          <p className="text-sm text-zinc-500">
            No games found for &quot;{trimmedQuery}&quot;.
          </p>
        )}

      {trimmedQuery.length >= MIN_QUERY_LENGTH &&
        state.kind === "results" &&
        state.results.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {state.results.slice(0, MAX_RESULTS).map((game) => (
            <li key={game.igdbId}>
              <button
                type="button"
                disabled={game.alreadyRanked}
                onClick={() => onSelectAction(game)}
                className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-zinc-50 dark:enabled:hover:bg-zinc-900"
              >
                <CoverImage
                  coverImageId={game.coverImageId}
                  size="cover_small"
                  className="h-16 w-12 shrink-0 rounded"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {game.name}
                    </span>
                    {game.alreadyRanked && (
                      <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Ranked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    {game.releaseYear && <span>{game.releaseYear}</span>}
                    {game.platforms.length > 0 && (
                      <span className="truncate">
                        {game.platforms.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
