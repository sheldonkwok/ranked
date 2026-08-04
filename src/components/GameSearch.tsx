"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CoverImage from "@/components/CoverImage";
import Banner from "@/components/ui/Banner";
import PixelLoader from "@/components/ui/PixelLoader";

export type GameSearchResult = {
  igdbId: number;
  name: string;
  coverImageId: string | null;
  firstReleaseDate: string | null;
  releaseYear: number | null;
  platforms: string[];
  summary: string | null;
};

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; results: GameSearchResult[] };

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export default function GameSearch({ onSelectAction }: { onSelectAction: (game: GameSearchResult) => void }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();

  const runSearch = useCallback(async (trimmed: string) => {
    const requestId = ++requestIdRef.current;
    setState({ kind: "loading" });

    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(trimmed)}`);

      if (requestId !== requestIdRef.current) return;

      if (res.status === 502) {
        setState({
          kind: "error",
          message: "Game search is unavailable (IGDB credentials not configured).",
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
        <div className="pixel-panel flex items-center gap-3 px-4 py-3">
          <span className="font-pixel text-[10px] text-gold-bright">&gt;</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SEARCH A TITLE"
            // biome-ignore lint/a11y/noAutofocus: this is the sole control on a dedicated /add search step, not a page loaded incidentally
            autoFocus
            className="flex-1 bg-transparent py-1 text-[17px] tracking-[1px] text-ink outline-none placeholder:text-ink-placeholder"
          />
        </div>
        <p className="text-xs tracking-[0.5px] text-ink-faint">
          Results appear as you type — press Enter to search now.
        </p>
      </form>

      {trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH && (
        <p className="text-sm text-ink-dim">Keep typing ({MIN_QUERY_LENGTH}+ characters)…</p>
      )}

      {/* Once the query drops below the minimum length, the effect stops
          updating `state`, so we gate all of its branches on the current
          query length here rather than resetting state synchronously. */}
      {trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "loading" && <PixelLoader label="Searching…" />}

      {trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "error" && (
        <Banner variant="error">{state.message}</Banner>
      )}

      {trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "results" && state.results.length === 0 && (
        <div className="pixel-panel px-10 py-10 text-center text-[14px] tracking-[1px] text-ink-faint">
          NO CARTRIDGES FOUND
        </div>
      )}

      {trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "results" && state.results.length > 0 && (
        <ul className="pixel-panel flex flex-col p-1.5">
          {state.results.map((game) => (
            <li key={game.igdbId}>
              <button
                type="button"
                onClick={() => onSelectAction(game)}
                className="pixel-row grid w-full items-center gap-4 p-[11px_14px] text-left"
                style={{ gridTemplateColumns: "42px 1fr auto" }}
              >
                <CoverImage
                  coverImageId={game.coverImageId}
                  size="cover_small"
                  className="h-14 w-[42px] shrink-0 border border-edge/45"
                />

                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate text-[16px] text-ink" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}>
                    {game.name}
                  </span>
                  <div className="flex items-center gap-2 text-xs tracking-[1px] text-ink-dim">
                    {game.releaseYear && <span>{game.releaseYear}</span>}
                    {game.platforms.length > 0 && <span className="truncate">{game.platforms.join(", ")}</span>}
                  </div>
                </div>

                <span className="font-pixel text-[8px] text-gold-bright">PICK</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
