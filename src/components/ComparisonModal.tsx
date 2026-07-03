"use client";

import CoverImage from "@/components/CoverImage";

type ComparisonGame = {
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
};

function CoverCard({
  game,
  onClick,
}: {
  game: ComparisonGame;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-3 rounded-lg border border-zinc-200 p-4 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      <CoverImage
        coverImageId={game.coverImageId}
        size="cover_big"
        className="aspect-[3/4] w-full max-w-40 rounded"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{game.name}</span>
        {game.releaseYear && (
          <span className="text-xs text-zinc-500">{game.releaseYear}</span>
        )}
      </div>
    </button>
  );
}

export default function ComparisonModal({
  newGame,
  candidate,
  onChooseAction,
  onSkipAction,
  comparisonsDone,
  maxComparisons,
}: {
  newGame: ComparisonGame;
  candidate: ComparisonGame;
  onChooseAction: (newGameWins: boolean) => void;
  onSkipAction: () => void;
  comparisonsDone: number;
  maxComparisons: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col gap-6 rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-lg font-semibold">Which did you like more?</h2>
          <p className="text-xs text-zinc-500">
            Comparison {comparisonsDone + 1} of ~{maxComparisons}
          </p>
        </div>

        <div className="flex items-stretch gap-4">
          <CoverCard game={newGame} onClick={() => onChooseAction(true)} />
          <div className="flex items-center text-xs font-medium text-zinc-400">
            vs
          </div>
          <CoverCard game={candidate} onClick={() => onChooseAction(false)} />
        </div>

        <button
          type="button"
          onClick={onSkipAction}
          className="self-center text-xs text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline dark:hover:text-zinc-300"
        >
          Too close — skip
        </button>
      </div>
    </div>
  );
}
