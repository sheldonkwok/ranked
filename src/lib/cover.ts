// Client-safe helper for building IGDB cover image URLs.
// No env access here — this is imported from both server and client components.

export type CoverSize = "cover_small" | "cover_big" | "thumb" | "720p";

export function coverUrl(
  imageId: string,
  size: CoverSize = "cover_big"
): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}
