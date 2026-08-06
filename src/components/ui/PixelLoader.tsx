import { cn } from "@/lib/cn";

const DELAYS = ["0ms", "150ms", "300ms"];

// Three staggered blinking squares — the pixel-language stand-in for a spinner; no built-in vertical padding, callers add their own `py-*` wrapper when needed.
export default function PixelLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-sm text-ink-dim", className)}>
      <span className="flex gap-1" aria-hidden="true">
        {DELAYS.map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 animate-blink bg-ink-dim motion-reduce:animate-none"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
