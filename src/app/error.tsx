"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { button } from "@/components/ui/button";
import { panel } from "@/components/ui/surface";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the error to the console (or an error reporting service).
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      <div className={panel({ className: "px-12 py-10 text-[14px] tracking-[1px] text-ink-faint" })}>
        SOMETHING BROKE
        <p className="mt-2 text-xs text-ink-dim">An unexpected error occurred. You can try again.</p>
      </div>
      <button type="button" onClick={reset} className={button({ variant: "gold" })}>
        TRY AGAIN
      </button>
    </div>
  );
}
