import Image from "next/image";
import { cn } from "@/lib/cn";
import { type CoverSize, coverUrl } from "@/lib/cover";

// Shared cover-art renderer with a placeholder for missing covers; pass `width`/`height` to render via `next/image` (above-the-fold usage), or omit them for a plain `<img>` that fills a fluid container.
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
    <div className={cn("overflow-hidden", className)}>
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
        <div aria-hidden="true" className="cover-hatch flex h-full w-full items-center justify-center">
          <span className="font-pixel text-[6px] text-ink-faint">COVER</span>
        </div>
      )}
    </div>
  );
}
