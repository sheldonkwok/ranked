"use client";

import { useReducer, useState } from "react";

export type ComparisonCandidate = {
  id: number;
  game: {
    name: string;
    coverImageId: string | null;
    releaseYear: number | null;
  };
};

export type ComparisonStatus = "idle" | "comparing" | "done";

export type ComparisonState = {
  status: ComparisonStatus;
  candidates: ComparisonCandidate[];
  lo: number;
  hi: number;
  comparisonsDone: number;
};

export type ComparisonAction =
  | { type: "init"; candidates: ComparisonCandidate[] }
  | { type: "choose"; newGameWins: boolean }
  | { type: "reset" };

/**
 * Binary-search state machine shared by the add-game flow and (later) the
 * re-rank flow. `candidates` must be pre-sorted best -> worst. Search
 * invariant: everything in [0, lo) beats the new game, everything in
 * [hi, n) loses to the new game; the new game belongs at index `lo` once
 * `lo >= hi`.
 */
export function createInitialState(
  candidates: ComparisonCandidate[] | null
): ComparisonState {
  const list = candidates ?? [];
  return {
    status: candidates === null ? "idle" : list.length === 0 ? "done" : "comparing",
    candidates: list,
    lo: 0,
    hi: list.length,
    comparisonsDone: 0,
  };
}

export function comparisonReducer(
  state: ComparisonState,
  action: ComparisonAction
): ComparisonState {
  switch (action.type) {
    case "init":
      return createInitialState(action.candidates);

    case "reset":
      return createInitialState(null);

    case "choose": {
      if (state.status !== "comparing") {
        return state;
      }

      const mid = Math.floor((state.lo + state.hi) / 2);
      // newGameWins → the new game ranks better than candidates[mid], so
      // the answer lies in [lo, mid]; otherwise it lies in [mid+1, hi).
      const nextLo = action.newGameWins ? state.lo : mid + 1;
      const nextHi = action.newGameWins ? mid : state.hi;

      const done = nextLo >= nextHi;

      return {
        ...state,
        lo: nextLo,
        hi: nextHi,
        comparisonsDone: state.comparisonsDone + 1,
        status: done ? "done" : "comparing",
      };
    }

    default:
      return state;
  }
}

export type UseComparisonRankingResult = {
  status: ComparisonStatus;
  currentCandidate: ComparisonCandidate | null;
  comparisonsDone: number;
  maxComparisons: number;
  choose(newGameWins: boolean): void;
  reset(): void;
  finalPosition: number | null;
};

/**
 * Drives a binary-search "which do you like more?" comparison loop over a
 * best -> worst sorted candidate list to find the insertion index for a new
 * item. Re-initializes whenever the `candidates` reference/identity changes
 * (pass a new array, e.g. from a fresh fetch, to start a new round).
 */
export function useComparisonRanking(
  candidates: ComparisonCandidate[] | null
): UseComparisonRankingResult {
  const [state, dispatch] = useReducer(
    comparisonReducer,
    candidates,
    createInitialState
  );

  // Re-sync whenever the caller hands us a new `candidates` array
  // reference (e.g. after fetching a different tier), following React's
  // "adjusting state during render" pattern instead of an effect so the
  // reset is visible in the same commit. Callers should pass a stable
  // array reference until they intend to restart the search.
  const [prevCandidates, setPrevCandidates] = useState(candidates);
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    dispatch({ type: "init", candidates: candidates ?? [] });
  }

  const n = state.candidates.length;
  const maxComparisons = n === 0 ? 0 : Math.ceil(Math.log2(n + 1));

  const currentCandidate =
    state.status === "comparing"
      ? state.candidates[Math.floor((state.lo + state.hi) / 2)]
      : null;

  function choose(newGameWins: boolean) {
    dispatch({ type: "choose", newGameWins });
  }

  function reset() {
    dispatch({ type: "reset" });
  }

  return {
    status: state.status,
    currentCandidate,
    comparisonsDone: state.comparisonsDone,
    maxComparisons,
    choose,
    reset,
    finalPosition: state.status === "done" ? state.lo : null,
  };
}
