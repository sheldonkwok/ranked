"use client";

import CoverImage from "@/components/CoverImage";
import ModalShell from "@/components/ui/ModalShell";

export type ComparisonGame = {
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
};

function CoverCard({ game, onClick }: { game: ComparisonGame; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pixel-row flex flex-1 flex-col items-center gap-3 border border-edge/45 p-4 text-center active:translate-y-0.5"
    >
      <CoverImage
        coverImageId={game.coverImageId}
        size="cover_big"
        className="aspect-[3/4] w-full max-w-40 border border-edge/45"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{game.name}</span>
        {game.releaseYear && <span className="text-xs text-ink-dim">{game.releaseYear}</span>}
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
  onCloseAction,
  closeDisabled,
}: {
  newGame: ComparisonGame;
  candidate: ComparisonGame;
  onChooseAction: (newGameWins: boolean) => void;
  onSkipAction: () => void;
  comparisonsDone: number;
  maxComparisons: number;
  onCloseAction?: () => void;
  closeDisabled?: boolean;
}) {
  return (
    <ModalShell onCloseAction={onCloseAction} closeDisabled={closeDisabled}>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="pixel-heading text-[12px]">WHICH DID YOU LIKE MORE?</h2>
        <p className="text-xs tracking-[1px] text-ink-dim">
          COMPARISON {comparisonsDone + 1} OF ~{maxComparisons}
        </p>
      </div>

      <div className="flex items-stretch gap-4">
        <CoverCard game={newGame} onClick={() => onChooseAction(true)} />
        <div className="font-pixel flex items-center text-[10px] text-gold">VS</div>
        <CoverCard game={candidate} onClick={() => onChooseAction(false)} />
      </div>

      <button type="button" onClick={onSkipAction} className="pixel-btn-ghost self-center">
        TOO CLOSE — SKIP
      </button>
    </ModalShell>
  );
}
