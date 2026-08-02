"use client";

// Shared overlay + panel chrome for ComparisonModal and RerankDialog — was
// previously duplicated near-verbatim between the two. `onClose` is optional
// because the add-flow's ComparisonModal has no cancel affordance (bailing
// mid-comparison there just loses the in-progress add); RerankDialog passes
// one so a re-rank can be cancelled even mid-comparison.
export default function ModalShell({
  onCloseAction,
  closeDisabled,
  children,
}: {
  onCloseAction?: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-[2px]">
      <div className="pixel-panel relative flex w-full max-w-lg flex-col gap-6 p-6">
        {onCloseAction && (
          <button
            type="button"
            onClick={onCloseAction}
            disabled={closeDisabled}
            aria-label="Close"
            title={closeDisabled ? "Saving…" : "Close"}
            className="pixel-btn-ghost absolute top-3 right-3 px-2 py-1 text-[13px]"
          >
            X
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
