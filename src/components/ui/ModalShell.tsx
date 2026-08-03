"use client";

import { useEffect } from "react";

// Shared overlay + panel chrome for ComparisonModal and EntryDialog — was
// previously duplicated near-verbatim between the two. `onClose` is optional
// because the add-flow's ComparisonModal has no cancel affordance (bailing
// mid-comparison there just loses the in-progress add); EntryDialog passes
// one so an edit can be cancelled even mid-comparison.
export default function ModalShell({
  onCloseAction,
  closeDisabled,
  children,
}: {
  onCloseAction?: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
}) {
  // Escape closes the modal, same guards as the X button below: a no-op
  // when there's nothing to close to (add-flow's ComparisonModal) or while
  // a save/remove is in flight.
  useEffect(() => {
    if (!onCloseAction || closeDisabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseAction?.();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCloseAction, closeDisabled]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" className="pixel-panel relative flex w-full max-w-lg flex-col gap-6 p-6">
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
