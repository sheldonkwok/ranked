import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      <div className="pixel-panel px-12 py-10 text-[14px] tracking-[1px] text-ink-faint">
        PAGE NOT FOUND
        <p className="mt-2 text-xs text-ink-dim">The page you&apos;re looking for doesn&apos;t exist.</p>
      </div>
      <Link href="/" className="pixel-btn-gold">
        GO HOME
      </Link>
    </div>
  );
}
