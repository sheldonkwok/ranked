"use client";

import { Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

const CONFIRM_MS = 1600;

/** Copies the signed-in user's own public /u/[username] link to the clipboard. */
export default function ShareButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleClick() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can fail (e.g. non-secure origin, denied permission)
      // — leave the icon as-is rather than claiming a copy that didn't happen.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Copy link to your ranking"
      className="icon-btn-gold flex items-center"
    >
      {copied ? (
        <Check size={20} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <Share2 size={20} strokeWidth={2.5} aria-hidden="true" />
      )}
    </button>
  );
}
