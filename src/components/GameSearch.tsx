"use client";

import { Cog, X } from "lucide-react";
import { useRouter } from "next/navigation";
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

type SteamLibraryResult = GameSearchResult & { playtimeForever: number };

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; results: GameSearchResult[] };

type SteamState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; results: SteamLibraryResult[] };

type RelatedState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; results: GameSearchResult[] };

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/** "45m" below an hour, otherwise whole hours ("142h") — Steam's own library UI is this coarse too. */
function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function GameResultRow({
  game,
  rightLabel,
  onSelect,
}: {
  game: GameSearchResult;
  rightLabel?: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="pixel-row grid w-full items-center gap-4 p-[11px_14px] text-left mobile:gap-3 mobile:p-[9px_12px]"
        style={{ gridTemplateColumns: "42px 1fr auto" }}
      >
        <CoverImage
          coverImageId={game.coverImageId}
          size="cover_small"
          className="h-14 w-[42px] shrink-0 border border-edge/45 mobile:h-12 mobile:w-9"
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

        <div className="flex items-center gap-3">
          {rightLabel && <span className="text-xs tracking-[1px] text-ink-dim">{rightLabel}</span>}
          <span className="font-pixel text-[8px] text-gold-bright">PICK</span>
        </div>
      </button>
    </li>
  );
}

export default function GameSearch({
  onSelectAction,
  steamLinked,
  relatedTo,
}: {
  onSelectAction: (game: GameSearchResult) => void;
  steamLinked: boolean;
  /** Game name from `?related=`, if any — locks the box into "related" mode on mount. */
  relatedTo: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [mode, setMode] = useState<"search" | "steam" | "related">(relatedTo ? "related" : "search");
  const [steamState, setSteamState] = useState<SteamState>({ kind: "idle" });
  const [relatedState, setRelatedState] = useState<RelatedState>({ kind: "idle" });
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const runSteamFetch = useCallback(async () => {
    setSteamState({ kind: "loading" });

    try {
      const res = await fetch("/api/games/steam-library");

      if (res.status === 400) {
        setSteamState({
          kind: "error",
          message: "Link your Steam account in Settings to import your library.",
        });
        return;
      }

      if (res.status === 502) {
        setSteamState({
          kind: "error",
          message: "Steam library import is unavailable right now. Try again.",
        });
        return;
      }

      if (!res.ok) {
        setSteamState({
          kind: "error",
          message: "Something went wrong loading your Steam library. Try again.",
        });
        return;
      }

      const data = (await res.json()) as { results: SteamLibraryResult[] };
      setSteamState({ kind: "results", results: data.results });
    } catch {
      setSteamState({
        kind: "error",
        message: "Something went wrong loading your Steam library. Try again.",
      });
    }
  }, []);

  // Fetch the library once per mount (the first time the cog is opened) —
  // toggling back to search and reopening it just re-shows the cached state.
  function handleToggleSteam() {
    if (mode === "steam") {
      setMode("search");
      return;
    }
    // Leaving related mode for Steam mode: drop `?related=` so backing out of
    // Steam mode later (or re-mounting) doesn't silently re-lock into related.
    if (mode === "related") {
      router.replace("/add", { scroll: false });
    }
    setMode("steam");
    if (steamState.kind === "idle") {
      runSteamFetch();
    }
  }

  const runRelatedFetch = useCallback(async (name: string) => {
    setRelatedState({ kind: "loading" });

    try {
      const res = await fetch(`/api/games/similar?name=${encodeURIComponent(name)}`);

      if (res.status === 404) {
        setRelatedState({
          kind: "error",
          message: "That game isn't in your ranking anymore.",
        });
        return;
      }

      if (res.status === 502) {
        setRelatedState({
          kind: "error",
          message: "Similar games are unavailable right now. Try again.",
        });
        return;
      }

      if (!res.ok) {
        setRelatedState({
          kind: "error",
          message: "Something went wrong finding similar games. Try again.",
        });
        return;
      }

      const data = (await res.json()) as { results: GameSearchResult[] };
      setRelatedState({ kind: "results", results: data.results });
    } catch {
      setRelatedState({
        kind: "error",
        message: "Something went wrong finding similar games. Try again.",
      });
    }
  }, []);

  // Fetch once on mount when the box opens directly into related mode via
  // `?related=`. There's no toggle button to re-trigger this (unlike Steam
  // mode's cog) — the box only ever enters related mode from the URL.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only — relatedTo/runRelatedFetch don't change in a way that should re-trigger this
  useEffect(() => {
    if (relatedTo) {
      runRelatedFetch(relatedTo);
    }
  }, []);

  // Unlocks the box back to a plain search and clears `?related=` so backing
  // out of a later screen (which re-mounts this component) doesn't re-lock.
  function handleExitRelated() {
    setMode("search");
    router.replace("/add", { scroll: false });
  }

  // Re-focus the (now re-enabled) input whenever we land back on search mode,
  // including the toggle-back from Steam library or related-games mode.
  useEffect(() => {
    if (mode === "search") inputRef.current?.focus();
  }, [mode]);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <div className="pixel-panel flex items-center gap-3 px-4 py-3">
          <span className="font-pixel text-[10px] text-gold-bright">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "steam"
                ? "STEAM LIBRARY"
                : mode === "related"
                  ? `GAMES LIKE ${relatedTo?.toUpperCase()}`
                  : "SEARCH A TITLE"
            }
            disabled={mode !== "search"}
            // biome-ignore lint/a11y/noAutofocus: this is the sole control on a dedicated /add search step, not a page loaded incidentally
            autoFocus
            className="flex-1 bg-transparent py-1 text-[17px] tracking-[1px] text-ink outline-none placeholder:text-ink-placeholder disabled:opacity-50"
          />
          {mode === "related" && (
            <button
              type="button"
              onClick={handleExitRelated}
              className="icon-btn-gold flex items-center"
              aria-label="Clear related game filter"
            >
              <X size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          {steamLinked && (
            <button
              type="button"
              onClick={handleToggleSteam}
              className="icon-btn-gold flex items-center"
              data-state={mode === "steam" ? "active" : undefined}
              aria-pressed={mode === "steam"}
              aria-label="Steam library"
            >
              <Cog size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-xs tracking-[0.5px] text-ink-faint">
          {mode === "steam" && "Your most-played Steam games you haven't ranked yet."}
          {mode === "related" && `Games similar to ${relatedTo} that you haven't ranked yet.`}
          {mode === "search" && "Results appear as you type — press Enter to search now."}
        </p>
      </form>

      {mode === "search" && trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH && (
        <p className="text-sm text-ink-dim">Keep typing ({MIN_QUERY_LENGTH}+ characters)…</p>
      )}

      {/* Once the query drops below the minimum length, the effect stops
          updating `state`, so we gate all of its branches on the current
          query length here rather than resetting state synchronously. */}
      {mode === "search" && trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "loading" && (
        <PixelLoader label="Searching…" />
      )}

      {mode === "search" && trimmedQuery.length >= MIN_QUERY_LENGTH && state.kind === "error" && (
        <Banner variant="error">{state.message}</Banner>
      )}

      {mode === "search" &&
        trimmedQuery.length >= MIN_QUERY_LENGTH &&
        state.kind === "results" &&
        state.results.length === 0 && (
          <div className="pixel-panel px-10 py-10 text-center text-[14px] tracking-[1px] text-ink-faint">
            NO CARTRIDGES FOUND
          </div>
        )}

      {mode === "search" &&
        trimmedQuery.length >= MIN_QUERY_LENGTH &&
        state.kind === "results" &&
        state.results.length > 0 && (
          <ul className="pixel-panel flex flex-col p-1.5">
            {state.results.map((game) => (
              <GameResultRow key={game.igdbId} game={game} onSelect={() => onSelectAction(game)} />
            ))}
          </ul>
        )}

      {mode === "steam" && steamState.kind === "loading" && <PixelLoader label="Loading your Steam library…" />}

      {mode === "steam" && steamState.kind === "error" && <Banner variant="error">{steamState.message}</Banner>}

      {mode === "steam" && steamState.kind === "results" && steamState.results.length === 0 && (
        <div className="pixel-panel px-10 py-10 text-center text-[14px] tracking-[1px] text-ink-faint">
          NOTHING LEFT TO RANK
        </div>
      )}

      {mode === "steam" && steamState.kind === "results" && steamState.results.length > 0 && (
        <ul className="pixel-panel flex flex-col p-1.5">
          {steamState.results.map((game) => (
            <GameResultRow
              key={game.igdbId}
              game={game}
              rightLabel={formatPlaytime(game.playtimeForever)}
              onSelect={() => onSelectAction(game)}
            />
          ))}
        </ul>
      )}

      {mode === "related" && relatedState.kind === "loading" && <PixelLoader label="Finding similar games…" />}

      {mode === "related" && relatedState.kind === "error" && <Banner variant="error">{relatedState.message}</Banner>}

      {mode === "related" && relatedState.kind === "results" && relatedState.results.length === 0 && (
        <div className="pixel-panel px-10 py-10 text-center text-[14px] tracking-[1px] text-ink-faint">
          NOTHING SIMILAR LEFT
        </div>
      )}

      {mode === "related" && relatedState.kind === "results" && relatedState.results.length > 0 && (
        <ul className="pixel-panel flex flex-col p-1.5">
          {relatedState.results.map((game) => (
            <GameResultRow key={game.igdbId} game={game} onSelect={() => onSelectAction(game)} />
          ))}
        </ul>
      )}
    </div>
  );
}
