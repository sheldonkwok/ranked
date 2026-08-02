import { describe, expect, it } from "vitest";
import {
  type ComparisonCandidate,
  type ComparisonState,
  comparisonReducer,
  createInitialState,
} from "./useComparisonRanking";

function candidate(id: number): ComparisonCandidate {
  return {
    id,
    game: { name: `Game ${id}`, coverImageId: null, releaseYear: null },
  };
}

function candidates(n: number): ComparisonCandidate[] {
  return Array.from({ length: n }, (_, i) => candidate(i));
}

/** Runs a scripted sequence of `choose()` answers against a state, returning the final state. */
function run(state: ComparisonState, answers: boolean[]): ComparisonState {
  return answers.reduce((s, newGameWins) => comparisonReducer(s, { type: "choose", newGameWins }), state);
}

describe("createInitialState", () => {
  it("is idle when candidates is null", () => {
    const state = createInitialState(null);
    expect(state.status).toBe("idle");
    expect(state.lo).toBe(0);
    expect(state.hi).toBe(0);
  });

  it("is immediately done with an empty candidate list (finalPosition 0)", () => {
    const state = createInitialState([]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(0);
    expect(state.hi).toBe(0);
  });

  it("is comparing with a non-empty candidate list", () => {
    const state = createInitialState(candidates(3));
    expect(state.status).toBe("comparing");
    expect(state.lo).toBe(0);
    expect(state.hi).toBe(3);
    expect(state.comparisonsDone).toBe(0);
  });
});

describe("comparisonReducer: binary search walk", () => {
  it("n=1: new game always wins -> lands at position 0 in a single comparison", () => {
    const state = run(createInitialState(candidates(1)), [true]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(0);
    expect(state.comparisonsDone).toBe(1);
  });

  it("n=1: new game always loses -> lands at position 1 in a single comparison", () => {
    const state = run(createInitialState(candidates(1)), [false]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(1);
    expect(state.comparisonsDone).toBe(1);
  });

  it("n=3: wins every comparison -> best position (0)", () => {
    // lo=0,hi=3 mid=1 win->hi=1; lo=0,hi=1 mid=0 win->hi=0; done lo=0
    const state = run(createInitialState(candidates(3)), [true, true]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(0);
    expect(state.comparisonsDone).toBe(2);
  });

  it("n=3: loses every comparison -> worst position (3)", () => {
    // lo=0,hi=3 mid=1 lose->lo=2; lo=2,hi=3 mid=2 lose->lo=3; done lo=3
    const state = run(createInitialState(candidates(3)), [false, false]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(3);
    expect(state.comparisonsDone).toBe(2);
  });

  it("n=3: wins then loses -> lands in the middle (position 1)", () => {
    // lo=0,hi=3 mid=1 win->hi=1; lo=0,hi=1 mid=0 lose->lo=1; done lo=1
    const state = run(createInitialState(candidates(3)), [true, false]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(1);
    expect(state.comparisonsDone).toBe(2);
  });

  it("n=7: wins every comparison -> best position (0) in ceil(log2(8))=3 comparisons", () => {
    const state = run(createInitialState(candidates(7)), [true, true, true]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(0);
    expect(state.comparisonsDone).toBe(3);
  });

  it("n=7: loses every comparison -> worst position (7)", () => {
    // lo=0,hi=7 mid=3 lose->lo=4; lo=4,hi=7 mid=5 lose->lo=6; lo=6,hi=7 mid=6 lose->lo=7
    const state = run(createInitialState(candidates(7)), [false, false, false]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(7);
    expect(state.comparisonsDone).toBe(3);
  });

  it("n=7: scripted mixed answers land at the expected position", () => {
    // lo=0,hi=7 mid=3 win->hi=3; lo=0,hi=3 mid=1 lose->lo=2; lo=2,hi=3 mid=2 win->hi=2; done lo=2
    const state = run(createInitialState(candidates(7)), [true, false, true]);
    expect(state.status).toBe("done");
    expect(state.lo).toBe(2);
    expect(state.comparisonsDone).toBe(3);
  });

  it("ignores choose actions once done (idempotent terminal state)", () => {
    const done = run(createInitialState(candidates(3)), [true, true]);
    const again = comparisonReducer(done, {
      type: "choose",
      newGameWins: false,
    });
    expect(again).toBe(done);
  });
});

describe("comparisonReducer: init and reset", () => {
  it("init replaces the state with a fresh search over new candidates", () => {
    const started = run(createInitialState(candidates(3)), [true]);
    const reinitialized = comparisonReducer(started, {
      type: "init",
      candidates: candidates(5),
    });
    expect(reinitialized.status).toBe("comparing");
    expect(reinitialized.lo).toBe(0);
    expect(reinitialized.hi).toBe(5);
    expect(reinitialized.comparisonsDone).toBe(0);
  });

  it("reset returns to idle", () => {
    const started = run(createInitialState(candidates(3)), [true]);
    const reset = comparisonReducer(started, { type: "reset" });
    expect(reset.status).toBe("idle");
    expect(reset.candidates).toEqual([]);
  });
});
