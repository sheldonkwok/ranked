"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Global "a" shortcut on the home page → jump straight to /add; renders nothing, just wires up the listener while mounted.
export default function AddHotkey() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "a" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // A modal (e.g. EntryDialog) can be open over the home list — navigating out from under it would be jarring, so leave it alone.
      if (document.querySelector('[aria-modal="true"]')) return;

      e.preventDefault();
      router.push("/add");
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
