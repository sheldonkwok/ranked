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

/** Binary-search state machine (shared by add-game and re-rank flows) over a best -> worst sorted `candidates` list: [0, lo) beats the new game, [hi, n) loses to it, and the new game belongs at `lo` once `lo >= hi`. */
export function createInitialState(candidates: ComparisonCandidate[] | null): ComparisonState {
  const list = candidates ?? [];
  return {
    status: candidates === null ? "idle" : list.length === 0 ? "done" : "comparing",
    candidates: list,
    lo: 0,
    hi: list.length,
    comparisonsDone: 0,
  };
}

export function comparisonReducer(state: ComparisonState, action: ComparisonAction): ComparisonState {
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
      // newGameWins narrows to [lo, mid] (new game beat candidates[mid]); otherwise narrows to [mid+1, hi).
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

/** Drives the binary-search comparison loop to find a new item's insertion index; re-initializes whenever the `candidates` array reference changes. */
export function useComparisonRanking(candidates: ComparisonCandidate[] | null): UseComparisonRankingResult {
  const [state, dispatch] = useReducer(comparisonReducer, candidates, createInitialState);

  // Re-syncs on a new `candidates` reference via React's "adjust state during render" pattern (not an effect) so the reset lands in the same commit; callers must keep the reference stable otherwise.
  const [prevCandidates, setPrevCandidates] = useState(candidates);
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    dispatch({ type: "init", candidates: candidates ?? [] });
  }

  const n = state.candidates.length;
  const maxComparisons = n === 0 ? 0 : Math.ceil(Math.log2(n + 1));

  const currentCandidate =
    state.status === "comparing" ? state.candidates[Math.floor((state.lo + state.hi) / 2)] : null;

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
