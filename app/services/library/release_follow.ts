import type { DateTime } from 'luxon'

/**
 * "Follow new releases" for artists and authors — the music and book side of
 * a monitored show. Only releases dated on or after the day following was
 * switched on qualify; an undated release never does, because a missing date
 * is far more often an old record with thin metadata than a new one.
 */

interface Followable {
  monitored: boolean
  monitoredAt: DateTime | null
}

/**
 * Whether a newly discovered album should be requested for this artist.
 * Studio albums and EPs only: singles, compilations, live records and remixes
 * are what fill a discography with duplicates of songs already owned.
 */
export function shouldRequestNewAlbum(
  artist: Followable,
  album: { releaseDate: DateTime | null; albumType: string; secondaryTypes?: string[] | null }
): boolean {
  if (!artist.monitored || !artist.monitoredAt || !album.releaseDate) return false
  if (album.albumType !== 'album' && album.albumType !== 'ep') return false
  if ((album.secondaryTypes ?? []).length > 0) return false
  return album.releaseDate >= artist.monitoredAt.startOf('day')
}

/** Whether a newly discovered book should be requested for this author. */
export function shouldRequestNewBook(
  author: Followable,
  firstPublishYear: number | null | undefined
): boolean {
  if (!author.monitored || !author.monitoredAt || !firstPublishYear) return false
  return firstPublishYear >= author.monitoredAt.year
}
