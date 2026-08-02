const DELAYS = ["0ms", "150ms", "300ms"];

// Three staggered blinking squares — the pixel-language stand-in for a spinner.
// No built-in vertical padding; callers that show this inline in a flow (vs.
// a tight action row) add their own `py-*` wrapper.
export default function PixelLoader({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-sm text-ink-dim ${className}`}>
      <span className="flex gap-1" aria-hidden="true">
        {DELAYS.map((delay) => (
          <span key={delay} className="blink h-2 w-2 bg-ink-dim" style={{ animationDelay: delay }} />
        ))}
      </span>
      {label}
    </div>
  );
}
