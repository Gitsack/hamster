import type { MediaType } from '#services/quality/quality_parser'

export interface MediaLinks {
  movieId?: string | null
  tvShowId?: string | null
  episodeId?: string | null
  albumId?: string | null
  bookId?: string | null
}

/**
 * Derive a download's media type from whichever media foreign key is set.
 *
 * Every Download row carries at most one media link, so the type is always
 * recoverable from the links themselves. Deriving it in one place keeps the
 * denormalised `media_type` column consistent with the FKs — it was previously
 * computed ad hoc at each call site and never persisted at all, leaving the
 * column (and its index) NULL on every row.
 *
 * Returns null when no link is set, which is itself meaningful: the download
 * could not be attributed to a library item.
 */
export function deriveMediaType(links: MediaLinks): MediaType | null {
  if (links.movieId) return 'movies'
  if (links.episodeId || links.tvShowId) return 'tv'
  if (links.bookId) return 'books'
  if (links.albumId) return 'music'
  return null
}
