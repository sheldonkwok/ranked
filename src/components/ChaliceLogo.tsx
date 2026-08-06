// Chalice-flame sprite: 16x16 grid, 4 frames — only flame rows (0-2) vary, so the chalice body is rendered once; frame cycling is driven by CSS (`.chalice-flame-*`/`@keyframes` in ./ChaliceLogo.css), not JS, so keep the two in sync.
import "./ChaliceLogo.css";

const PALETTE: Record<string, string> = {
  "#": "#2B1D06", // outline
  H: "#FFEFB5", // gold highlight
  M: "#EFB93F", // gold mid
  S: "#A6741C", // gold shadow
  t: "#EAFCFF", // flame tip
  c: "#BFEEFF", // flame core
  f: "#38A0F5", // flame mid
  d: "#1E5FD6", // flame deep
};

const CHALICE_ROWS = [
  "...dffccccffd...",
  "...dffccccffd...",
  "...##########...",
  "..#HHMMMMMMSS#..",
  "...#HMMMMMSS#...",
  "...#HMMMMMSS#...",
  "....#MMMMSS#....",
  ".....##MS##.....",
  "......#MS#......",
  ".....#MMSS#.....",
  "...#HHMMMMSS#...",
  "...##########...",
  "................",
];

const FLAME_ROWS = [
  [".......tt.......", "....f.fccf.f....", "....dffccffd...."], // frame 0: neutral
  ["......tt........", "....ffccff.f....", "....dfcccffd...."], // frame 1: leans left
  ["........tt......", "....f.ffccff....", "....dffcccfd...."], // frame 2: leans right
  ["................", "....f.fccf.f....", "....dffccffd...."], // frame 3: dips
];

type Rect = { x: number; y: number; width: number; height: number; fill: string };

function toRects(rows: string[], rowOffset: number): Rect[] {
  const rects: Rect[] = [];
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    let col = 0;
    while (col < 16) {
      const ch = line[col];
      if (ch === ".") {
        col++;
        continue;
      }
      let end = col + 1;
      while (end < 16 && line[end] === ch) end++;
      rects.push({ x: col, y: row + rowOffset, width: end - col, height: 1, fill: PALETTE[ch] });
      col = end;
    }
  }
  return rects;
}

// Precomputed once at module load, not per render.
const CHALICE_RECTS = toRects(CHALICE_ROWS, 3);
const FLAME_RECTS = FLAME_ROWS.map((rows) => toRects(rows, 0));

export default function ChaliceLogo({ className = "block h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden="true">
      {FLAME_RECTS.map((rects, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: frame order is static
        <g key={i} className={`chalice-flame chalice-flame-${i}`}>
          {rects.map((r) => (
            <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={r.height} fill={r.fill} />
          ))}
        </g>
      ))}
      <g>
        {CHALICE_RECTS.map((r) => (
          <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={r.height} fill={r.fill} />
        ))}
      </g>
    </svg>
  );
}
