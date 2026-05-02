import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Album from '#models/album'
import Book from '#models/book'

export interface ParsedFolderName {
  title?: string
  year?: number
  season?: number
  episode?: number
  artist?: string
  album?: string
  author?: string
  bookTitle?: string
}

export type LibraryMatch =
  | { type: 'movie'; id: string; title: string }
  | { type: 'episode'; id: string; title: string; tvShowId: string }
  | { type: 'album'; id: string; title: string }
  | { type: 'book'; id: string; title: string }

/**
 * Parse a release/folder name into media-relevant components.
 */
export function parseFolderName(folderName: string): ParsedFolderName {
  const result: ParsedFolderName = {}

  const cleaned = folderName
    .replace(/-xpost$/i, '')
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .trim()

  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    result.year = Number.parseInt(yearMatch[1])
  }

  const tvMatch = cleaned.match(/(.+?)\s*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i)
  if (tvMatch) {
    result.title = tvMatch[1].trim()
    result.season = Number.parseInt(tvMatch[2] || tvMatch[4])
    result.episode = Number.parseInt(tvMatch[3] || tvMatch[5])
    return result
  }

  const musicMatch = cleaned.match(
    /^(.+?)\s*-\s*(.+?)(?:\s+(?:CD|LP|EP|FLAC|MP3|WEB|Vinyl|\d{4}))/i
  )
  if (musicMatch) {
    result.artist = musicMatch[1].trim()
    result.album = musicMatch[2].trim()
    return result
  }

  const bookMatch =
    cleaned.match(/^(.+?)\s+by\s+(.+?)(?:\s+epub|\s+mobi|\s+pdf)?$/i) ||
    cleaned.match(/^(.+?)\s*-\s*(.+?)(?:\s+epub|\s+mobi|\s+pdf)?$/i)
  if (bookMatch && cleaned.match(/epub|mobi|pdf|audiobook|ebook/i)) {
    result.author = bookMatch[2]?.trim() || bookMatch[1]?.trim()
    result.bookTitle = bookMatch[1]?.trim() || bookMatch[2]?.trim()
    return result
  }

  const titleMatch = cleaned.match(
    /^(.+?)(?:\s+(?:REMASTERED|COMPLETE|EXTENDED|DIRECTORS|UNCUT|THEATRICAL|PROPER|RERIP|BLURAY|BLU-RAY|BDRIP|HDRIP|DVDRIP|WEBRIP|WEB-DL|HDTV|720p|1080p|2160p|4K|UHD|x264|x265|HEVC|H\.?264|H\.?265|AAC|DTS|AC3|ATMOS|REMUX|NF|AMZN|DSNP|ATVP))/i
  )
  if (titleMatch) {
    result.title = titleMatch[1].replace(/\b\d{4}\b/, '').trim()
  } else {
    result.title = cleaned.split(/\s+\d{4}\s+|\s+-\s+/)[0].trim()
  }

  return result
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

export function isSimilar(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true
  if (a.length < 20 && b.length < 20) {
    const distance = levenshtein(a, b)
    const maxLength = Math.max(a.length, b.length)
    return distance / maxLength < 0.3
  }
  return false
}

/**
 * Match a title/folder name to a requested library item.
 * Returns the first match found, or null if none.
 *
 * One-shot: queries the DB on each call. Suitable for occasional use
 * (e.g. orphan recovery during import). For batch use, prefer a
 * cache-backed implementation.
 */
export async function matchTitleToLibrary(folderName: string): Promise<LibraryMatch | null> {
  const parsed = parseFolderName(folderName)

  if (parsed.title && (parsed.season !== undefined || parsed.episode !== undefined)) {
    const ep = await matchEpisode(parsed.title, parsed.season, parsed.episode)
    if (ep) return ep
  }

  if (parsed.title) {
    const movie = await matchMovie(parsed.title, parsed.year)
    if (movie) return movie
  }

  if (parsed.artist && parsed.album) {
    const album = await matchAlbum(parsed.artist, parsed.album)
    if (album) return album
  }

  if (parsed.author && parsed.bookTitle) {
    const book = await matchBook(parsed.author, parsed.bookTitle)
    if (book) return book
  }

  if (parsed.title && parsed.season === undefined && parsed.episode === undefined) {
    const movie = await matchMovie(parsed.title, undefined)
    if (movie) return movie
  }

  return null
}

async function matchMovie(
  title: string,
  year?: number
): Promise<{ type: 'movie'; id: string; title: string } | null> {
  const wanted = normalize(title)
  const movies = await Movie.query().where('requested', true)
  for (const movie of movies) {
    if (!isSimilar(wanted, normalize(movie.title))) continue
    if (year && movie.year && Math.abs(year - movie.year) > 1) continue
    return { type: 'movie', id: movie.id, title: movie.title }
  }
  return null
}

async function matchEpisode(
  title: string,
  season?: number,
  episode?: number
): Promise<{ type: 'episode'; id: string; title: string; tvShowId: string } | null> {
  if (season === undefined || episode === undefined) return null
  const wanted = normalize(title)
  const shows = await TvShow.query().where('requested', true)
  for (const show of shows) {
    if (!isSimilar(wanted, normalize(show.title))) continue
    const ep = await Episode.query()
      .where('tvShowId', show.id)
      .where('seasonNumber', season)
      .where('episodeNumber', episode)
      .first()
    if (ep) {
      return {
        type: 'episode',
        id: ep.id,
        title: `${show.title} S${season}E${episode}`,
        tvShowId: show.id,
      }
    }
  }
  return null
}

async function matchAlbum(
  artist: string,
  albumTitle: string
): Promise<{ type: 'album'; id: string; title: string } | null> {
  const wantedArtist = normalize(artist)
  const wantedAlbum = normalize(albumTitle)
  const albums = await Album.query().where('requested', true).preload('artist')
  for (const album of albums) {
    const artistName = (album as unknown as { artist?: { name?: string } }).artist?.name || ''
    if (!isSimilar(wantedAlbum, normalize(album.title))) continue
    if (!isSimilar(wantedArtist, normalize(artistName))) continue
    return { type: 'album', id: album.id, title: `${artistName} - ${album.title}` }
  }
  return null
}

async function matchBook(
  author: string,
  bookTitle: string
): Promise<{ type: 'book'; id: string; title: string } | null> {
  const wantedAuthor = normalize(author)
  const wantedTitle = normalize(bookTitle)
  const books = await Book.query().where('requested', true).preload('author')
  for (const book of books) {
    const authorName = (book as unknown as { author?: { name?: string } }).author?.name || ''
    if (!isSimilar(wantedTitle, normalize(book.title))) continue
    if (!isSimilar(wantedAuthor, normalize(authorName))) continue
    return { type: 'book', id: book.id, title: `${authorName} - ${book.title}` }
  }
  return null
}
