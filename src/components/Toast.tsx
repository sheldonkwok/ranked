"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { panel } from "@/components/ui/surface";

const DISMISS_MS = 2200;

// Bottom-center flash shown after a successful rank/re-rank; strips the `?ranked=` query param via router.replace so a refresh doesn't re-show it.
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
      className={panel({
        className:
          "fixed bottom-[34px] left-1/2 z-[60] -translate-x-1/2 px-[22px] py-[14px] font-pixel text-[10px] text-ink",
      })}
      style={{
        background: "linear-gradient(90deg, rgba(46,104,220,0.95) 0%, rgba(10,20,44,0.9) 100%)",
        borderColor: "color-mix(in srgb, var(--color-edge) 70%, transparent)",
      }}
    >
      {message}
    </div>
  );
}
