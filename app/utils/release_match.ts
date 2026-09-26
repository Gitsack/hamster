/**
 * Deciding whether an indexer release is the one album or book we asked for.
 *
 * Indexers answer an "artist + album" query with whatever contains those words,
 * and the best-quality hit is very often a discography or collection pack: a
 * 40 GB "Artist - Discography (1990-2020) [FLAC]" beats a single album on every
 * quality measure. Grabbing it downloads the artist's whole catalogue into the
 * one album that was requested. Movies and episodes have always had a title
 * check before a grab; these are the music and book equivalents.
 */

/**
 * Lowercase words only: accents folded, `&` spelled out, separators and
 * punctuation gone. Both sides of every comparison go through this.
 */
export function normalizeReleaseText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[._\-–—/:]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Words that mark a release as many items bundled together. */
const MUSIC_PACK_PATTERNS: RegExp[] = [
  /\bdiscograph(y|ie)\b/,
  /\bdiscografia\b/,
  /\bdiskografie\b/,
  /\bdiscog\b/,
  /\banthology\b/,
  /\bcollection\b/,
  /\bbox ?set\b/,
  /\bcomplete (works|albums|recordings|studio albums|discography)\b/,
  /\ball albums\b/,
  /\b\d+ (albums|lps|cds|eps)\b/,
  /\balbums\b/,
  /\b(mp3|flac) pack\b/,
]

const BOOK_PACK_PATTERNS: RegExp[] = [
  /\bcollection\b/,
  /\bcomplete (series|works|novels|collection)\b/,
  /\bbox ?set\b/,
  /\bomnibus\b/,
  /\bbundle\b/,
  /\banthology\b/,
  /\bbooks? \d+ ?(to|\d+)\b/, // "Books 1-7", "Book 1 to 5"
  /\b\d+ (books|novels|ebooks)\b/,
  /\bebook pack\b/,
  /\bpack\b/,
]

/** "1990-2020": a span of years names a career, not a record. */
const YEAR_RANGE = /\b(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}\b/

/**
 * Whether the release is a bundle of several albums/books, judged against the
 * wanted title so that an album actually called "The Collection" still matches.
 */
export function isPackRelease(
  releaseTitle: string,
  wantedTitle: string,
  kind: 'music' | 'books'
): boolean {
  const release = normalizeReleaseText(releaseTitle)
  const wanted = normalizeReleaseText(wantedTitle)
  const patterns = kind === 'music' ? MUSIC_PACK_PATTERNS : BOOK_PACK_PATTERNS

  for (const pattern of patterns) {
    if (pattern.test(release) && !pattern.test(wanted)) return true
  }

  return YEAR_RANGE.test(releaseTitle) && !YEAR_RANGE.test(wantedTitle)
}

/** Every word index just past an occurrence of `phrase` in `text`, matched as whole words. */
function phraseEnds(text: string, phrase: string): number[] {
  if (!phrase) return []
  const words = text.split(' ')
  const target = phrase.split(' ')
  const ends: number[] = []
  for (let i = 0; i + target.length <= words.length; i++) {
    if (target.every((w, j) => words[i + j] === w)) ends.push(i + target.length)
  }
  return ends
}

function hasPhrase(text: string, phrase: string): boolean {
  return phraseEnds(text, phrase).length > 0
}

/** The title without edition noise: "Album (Deluxe Edition) [Remastered]" → "Album". */
function coreTitle(title: string): string {
  return title
    .replace(/\s*[([].*?[)\]]/g, '')
    .split(/\s[-–—:]\s|:\s/)[0]
    .trim()
}

/** Artist names as releases spell them: "The Beatles" also appears as "Beatles". */
function artistVariants(artistName: string): string[] {
  const name = normalizeReleaseText(artistName)
  const variants = new Set([name])
  if (name.startsWith('the ')) variants.add(name.slice(4))
  if (name === 'various artists') {
    variants.add('va')
    variants.add('various')
  }
  return [...variants].filter(Boolean)
}

/**
 * Words allowed straight after the album title. Anything else means the
 * release names a different, longer title: "Red" must not take
 * "Red (Taylor's Version)", and "Abbey Road" must not take "Abbey Road Sessions".
 */
const AFTER_ALBUM_WORDS = new Set([
  'flac',
  'mp3',
  'aac',
  'alac',
  'ogg',
  'opus',
  'wav',
  'dsd',
  'dsf',
  'sacd',
  'mqa',
  'm4a',
  'lossless',
  'lossy',
  'hi',
  'hires',
  'hr',
  'v0',
  'v2',
  'cbr',
  'vbr',
  'kbps',
  'bit',
  'khz',
  'web',
  'webflac',
  'cd',
  'cdda',
  'cdrip',
  'vinyl',
  'lp',
  'ep',
  'single',
  'album',
  'deluxe',
  'remaster',
  'remastered',
  'expanded',
  'edition',
  'anniversary',
  'bonus',
  'special',
  'limited',
  'reissue',
  'retail',
  'proper',
  'repack',
  'disc',
  'disk',
  'ost',
  'soundtrack',
  'promo',
  'advance',
  'readnfo',
  'internal',
  'by',
])

function isAllowedAfterAlbum(word: string): boolean {
  return (
    AFTER_ALBUM_WORDS.has(word) ||
    /^\d+$/.test(word) || // year, bitrate, "24", "96"
    /^\d+(bit|khz|kbps|cd|lp)$/.test(word) || // 24bit, 320kbps, 2cd
    /^cd\d+$/.test(word)
  )
}

function matchesAlbumTitle(release: string, title: string): boolean {
  const words = release.split(' ')
  // Every occurrence counts: in "Weezer - Weezer (2001) [FLAC]" the first hit is
  // the artist. The title must end the release or be followed by a year or a
  // format/edition word — scene names always carry the year before the group.
  return phraseEnds(release, title).some(
    (end) => end === words.length || isAllowedAfterAlbum(words[end])
  )
}

/**
 * Whether an indexer release is the requested album of this artist, and only
 * that album.
 */
export function isAlbumRelease(
  releaseTitle: string,
  artistName: string | null | undefined,
  albumTitle: string
): boolean {
  if (isPackRelease(releaseTitle, albumTitle, 'music')) return false

  const release = normalizeReleaseText(releaseTitle)

  if (artistName) {
    const hasArtist = artistVariants(artistName).some((a) => hasPhrase(release, a))
    if (!hasArtist) return false
  }

  const titles = new Set([
    normalizeReleaseText(albumTitle),
    normalizeReleaseText(coreTitle(albumTitle)),
  ])
  return [...titles].some((t) => t && matchesAlbumTitle(release, t))
}

/**
 * Whether an indexer release is the requested book by this author, and not a
 * collection it happens to be part of.
 */
export function isBookRelease(
  releaseTitle: string,
  authorName: string | null | undefined,
  bookTitle: string
): boolean {
  if (isPackRelease(releaseTitle, bookTitle, 'books')) return false

  const release = normalizeReleaseText(releaseTitle)
  const releaseWords = new Set(release.split(' '))

  if (authorName) {
    // Book releases write authors both ways round ("Tolkien, J.R.R."), so ask
    // for the surname rather than the name as one phrase.
    const authorWords = normalizeReleaseText(authorName).split(' ').filter(Boolean)
    const surname = authorWords[authorWords.length - 1]
    if (surname && !releaseWords.has(surname)) return false
  }

  const titles = new Set([
    normalizeReleaseText(bookTitle),
    normalizeReleaseText(coreTitle(bookTitle)),
  ])
  return [...titles].some((t) => t && hasPhrase(release, t))
}

/**
 * Whether an audio file's album tag names the album we are importing into.
 * Tags carry edition suffixes the metadata may not ("OK Computer (Remastered)"),
 * so the core titles are compared and either may contain the other.
 */
export function isSameAlbumTitle(tagAlbum: string, albumTitle: string): boolean {
  const a = normalizeReleaseText(coreTitle(tagAlbum)) || normalizeReleaseText(tagAlbum)
  const b = normalizeReleaseText(coreTitle(albumTitle)) || normalizeReleaseText(albumTitle)
  if (!a || !b) return true
  return a === b || hasPhrase(a, b) || hasPhrase(b, a)
}
