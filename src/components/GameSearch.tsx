"use client";

import { Cog, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import CoverImage from "@/components/CoverImage";
import Banner from "@/components/ui/Banner";
import { iconButton } from "@/components/ui/button";
import PixelLoader from "@/components/ui/PixelLoader";
import { panel, row } from "@/components/ui/surface";

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

type FranchiseState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "results"; franchiseName: string | null; results: GameSearchResult[] };

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
        className={row({
          className: "grid w-full items-center gap-4 p-[11px_14px] text-left mobile:gap-3 mobile:p-[9px_12px]",
        })}
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
  franchiseOf,
}: {
  onSelectAction: (game: GameSearchResult) => void;
  steamLinked: boolean;
  /** Game name from `?franchise=`, if any — locks the box into "franchise" mode on mount. */
  franchiseOf: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [mode, setMode] = useState<"search" | "steam" | "franchise">(franchiseOf ? "franchise" : "search");
  const [steamState, setSteamState] = useState<SteamState>({ kind: "idle" });
  const [franchiseState, setFranchiseState] = useState<FranchiseState>({ kind: "idle" });
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

    // Too short to search: leave prior search state untouched (it's simply not rendered while the query is short) rather than resetting it synchronously here.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    // Hold the timer in a local so cleanup cancels *this* effect's timer rather than whatever's in the ref by then; the ref exists only so `handleSubmit` can cancel a still-pending debounce.
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

  // Fetch the library once per mount (first time the cog opens) — toggling back to search and reopening just re-shows the cached state.
  function handleToggleSteam() {
    if (mode === "steam") {
      setMode("search");
      return;
    }
    // Leaving franchise mode for Steam mode: drop `?franchise=` so backing out later (or re-mounting) doesn't silently re-lock into franchise mode.
    if (mode === "franchise") {
      router.replace("/add", { scroll: false });
    }
    setMode("steam");
    if (steamState.kind === "idle") {
      runSteamFetch();
    }
  }

  const runFranchiseFetch = useCallback(async (name: string) => {
    setFranchiseState({ kind: "loading" });

    try {
      const res = await fetch(`/api/games/franchise?name=${encodeURIComponent(name)}`);

      if (res.status === 404) {
        setFranchiseState({
          kind: "error",
          message: "That game isn't in your ranking anymore.",
        });
        return;
      }

      if (res.status === 502) {
        setFranchiseState({
          kind: "error",
          message: "Franchise games are unavailable right now. Try again.",
        });
        return;
      }

      if (!res.ok) {
        setFranchiseState({
          kind: "error",
          message: "Something went wrong finding franchise games. Try again.",
        });
        return;
      }

      const data = (await res.json()) as { target: { franchiseName: string | null }; results: GameSearchResult[] };
      setFranchiseState({ kind: "results", franchiseName: data.target.franchiseName, results: data.results });
    } catch {
      setFranchiseState({
        kind: "error",
        message: "Something went wrong finding franchise games. Try again.",
      });
    }
  }, []);

  // Fetch once on mount when the box opens directly into franchise mode via `?franchise=` — there's no toggle to re-trigger this (unlike Steam mode's cog).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only — franchiseOf/runFranchiseFetch don't change in a way that should re-trigger this
  useEffect(() => {
    if (franchiseOf) {
      runFranchiseFetch(franchiseOf);
    }
  }, []);

  // Unlocks the box back to plain search and clears `?franchise=` so backing out of a later screen (which re-mounts this component) doesn't re-lock.
  function handleExitFranchise() {
    setMode("search");
    router.replace("/add", { scroll: false });
  }

  // Re-focus the (now re-enabled) input whenever we land back on search mode, including toggle-back from Steam library or franchise mode.
  useEffect(() => {
    if (mode === "search") inputRef.current?.focus();
  }, [mode]);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <div className={panel({ className: "flex items-center gap-3 px-4 py-3" })}>
          <span className="font-pixel text-[10px] text-gold-bright">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "steam"
                ? "STEAM LIBRARY"
                : mode === "franchise"
                  ? franchiseState.kind === "results" && franchiseState.franchiseName
                    ? `${franchiseState.franchiseName.toUpperCase()} SERIES`
                    : `${franchiseOf?.toUpperCase()} FRANCHISE`
                  : "SEARCH A TITLE"
            }
            disabled={mode !== "search"}
            // biome-ignore lint/a11y/noAutofocus: this is the sole control on a dedicated /add search step, not a page loaded incidentally
            autoFocus
            className="flex-1 bg-transparent py-1 text-[17px] tracking-[1px] text-ink outline-none placeholder:text-ink-placeholder disabled:opacity-50"
          />
          {mode === "franchise" && (
            <button
              type="button"
              onClick={handleExitFranchise}
              className={iconButton({ className: "flex items-center" })}
              aria-label="Clear franchise filter"
            >
              <X size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          {steamLinked && (
            <button
              type="button"
              onClick={handleToggleSteam}
              className={iconButton({ className: "flex items-center" })}
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
          {mode === "franchise" &&
            (franchiseState.kind === "results" && franchiseState.franchiseName
              ? `Games in the ${franchiseState.franchiseName} series you haven't ranked yet.`
              : `Games in the same franchise as ${franchiseOf} that you haven't ranked yet.`)}
          {mode === "search" && "Results appear as you type — press Enter to search now."}
        </p>
      </form>

      {mode === "search" && trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH && (
        <p className="text-sm text-ink-dim">Keep typing ({MIN_QUERY_LENGTH}+ characters)…</p>
      )}

      {/* Once the query drops below the minimum length, the effect stops updating `state`, so we gate all its branches on the current query length here instead of resetting synchronously. */}
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
          <div className={panel({ className: "px-10 py-10 text-center text-[14px] tracking-[1px] text-ink-faint" })}>
            NO CARTRIDGES FOUND
          </div>
        )}

      {mode === "search" &&
        trimmedQuery.length >= MIN_QUERY_LENGTH &&
        state.kind === "results" &&
        state.results.length > 0 && (
          <ul className={panel({ className: "flex flex-col p-1.5" })}>
            {state.results.map((game) => (
              <GameResultRow key={game.igdbId} game={game} onSelect={() => onSelectAction(game)} />
            ))}
          </ul>
        )}

      {mode === "steam" && steamState.kind === "loading" && <PixelLoader label="Loading your Steam library…" />}

      {mode === "steam" && steamState.kind === "error" && <Banner variant="error">{steamState.message}</Banner>}

      {mode === "steam" && steamState.kind === "results" && steamState.results.length === 0 && (
        <div className={panel({ className: "px-10 py-10 text-center text-[14px] tracking-[1px] text-ink-faint" })}>
          NOTHING LEFT TO RANK
        </div>
      )}

      {mode === "steam" && steamState.kind === "results" && steamState.results.length > 0 && (
        <ul className={panel({ className: "flex flex-col p-1.5" })}>
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

      {mode === "franchise" && franchiseState.kind === "loading" && <PixelLoader label="Finding franchise games…" />}

      {mode === "franchise" && franchiseState.kind === "error" && (
        <Banner variant="error">{franchiseState.message}</Banner>
      )}

      {mode === "franchise" && franchiseState.kind === "results" && franchiseState.results.length === 0 && (
        <div className={panel({ className: "px-10 py-10 text-center text-[14px] tracking-[1px] text-ink-faint" })}>
          NOTHING LEFT IN THIS FRANCHISE
        </div>
      )}

      {mode === "franchise" && franchiseState.kind === "results" && franchiseState.results.length > 0 && (
        <ul className={panel({ className: "flex flex-col p-1.5" })}>
          {franchiseState.results.map((game) => (
            <GameResultRow key={game.igdbId} game={game} onSelect={() => onSelectAction(game)} />
          ))}
        </ul>
      )}
    </div>
  );
}
