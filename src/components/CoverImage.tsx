import Image from "next/image";
import { type CoverSize, coverUrl } from "@/lib/cover";

// Shared cover-art renderer used anywhere a game's box art shows up
// (ranked list rows, search results, tier/comparison cards). Handles the
// missing-cover case consistently with a neutral placeholder box.
//
// Pass `width`/`height` to render via `next/image` (for on-page, above-the-
// fold usage where optimization is worth it, e.g. the ranked list). Omit
// them to render a plain `<img>` that fills its container — useful when the
// container's size comes from a fluid class (e.g. `aspect-[3/4]`) rather
// than fixed pixel dimensions next/image requires.
type CoverImageProps = {
  coverImageId: string | null;
  size?: CoverSize;
  className: string;
  width?: number;
  height?: number;
  alt?: string;
};

export default function CoverImage({
  coverImageId,
  size = "cover_big",
  className,
  width,
  height,
  alt = "",
}: CoverImageProps) {
  return (
    <div className={`overflow-hidden ${className}`}>
      {coverImageId ? (
        width !== undefined && height !== undefined ? (
          <Image
            src={coverUrl(coverImageId, size)}
            alt={alt}
            width={width}
            height={height}
            className="h-full w-full object-cover"
          />
        ) : (
          // biome-ignore lint/performance/noImgElement: external IGDB CDN image, dimensions vary
          <img src={coverUrl(coverImageId, size)} alt={alt} className="h-full w-full object-cover" />
        )
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center bg-zinc-200 text-base dark:bg-zinc-800"
        >
          🎮
        </div>
      )}
    </div>
  );
}
