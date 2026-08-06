"use client";

import { useEffect, useRef } from "react";
import { button } from "@/components/ui/button";
import { panel } from "@/components/ui/surface";

// Shared overlay + panel chrome for ComparisonModal and EntryDialog; `onClose` is optional since add-flow's ComparisonModal has no cancel affordance (bailing there just loses the in-progress add), while EntryDialog passes one so an edit can be cancelled mid-comparison.
export default function ModalShell({
  onCloseAction,
  closeDisabled,
  children,
}: {
  onCloseAction?: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // `aria-modal` claims the rest of the page is hidden, so focus must actually move inside the panel or the screen reader claims the still-focused trigger doesn't exist; restore focus on unmount so closing from row 30 doesn't dump the user at the top.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  // Escape closes the modal with the same guards as the X button: a no-op when there's nothing to close to (add-flow's ComparisonModal) or while a save/remove is in flight.
  useEffect(() => {
    if (!onCloseAction || closeDisabled) return;
    const close = onCloseAction;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCloseAction, closeDisabled]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-[2px] mobile:p-2">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={panel({ className: "relative flex w-full max-w-lg flex-col gap-6 p-6 outline-none mobile:p-4" })}
      >
        {onCloseAction && (
          <button
            type="button"
            onClick={onCloseAction}
            disabled={closeDisabled}
            aria-label="Close"
            // `closeDisabled` covers both saving and removing, so stay generic.
            title={closeDisabled ? "Busy…" : "Close"}
            className={button({ variant: "ghost", className: "absolute top-3 right-3 px-2 py-1 text-[13px]" })}
          >
            X
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
