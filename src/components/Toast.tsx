"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DISMISS_MS = 2200;

// Bottom-center flash shown after a successful rank/re-rank. Reads its
// message once on mount, then strips the `?ranked=` query param via
// router.replace so a page refresh doesn't re-show it.
export default function Toast({ message }: { message: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      router.replace("/");
    }, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [router]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pixel-panel font-pixel fixed bottom-[34px] left-1/2 z-[60] -translate-x-1/2 px-[22px] py-[14px] text-[10px] text-ink"
      style={{
        background: "linear-gradient(90deg, rgba(46,104,220,0.95) 0%, rgba(10,20,44,0.9) 100%)",
        borderColor: "color-mix(in srgb, var(--color-edge) 70%, transparent)",
      }}
    >
      {message}
    </div>
  );
}
