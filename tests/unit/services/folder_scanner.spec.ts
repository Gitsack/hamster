import { test } from '@japa/runner'

// Replicate private detectMediaType logic from FolderScanner
// (since the actual method requires filesystem access, we test the classification logic)

const AUDIO_EXTENSIONS = [
  '.flac',
  '.mp3',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.wav',
  '.wma',
  '.alac',
  '.ape',
  '.wv',
  '.dsf',
  '.dff',
]
const VIDEO_EXTENSIONS = [
  '.mkv',
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
  '.mpg',
  '.mpeg',
  '.ts',
  '.m2ts',
  '.vob',
  '.ogv',
]
const BOOK_EXTENSIONS = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.fb2', '.djvu', '.cbz', '.cbr']

function isVideoFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return VIDEO_EXTENSIONS.includes(ext)
}

function isAudioFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return AUDIO_EXTENSIONS.includes(ext)
}

function isBookFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return BOOK_EXTENSIONS.includes(ext)
}

type MediaType = 'music' | 'movies' | 'tv' | 'books'

function detectMediaTypeFromFiles(
  fileNames: string[],
  folderName: string
): MediaType | null {
  let videoCount = 0
  let audioCount = 0
  let bookCount = 0

  for (const file of fileNames) {
    if (isVideoFile(file)) videoCount++
    if (isAudioFile(file)) audioCount++
    if (isBookFile(file)) bookCount++
  }

  if (videoCount > 0 && videoCount >= audioCount && videoCount >= bookCount) {
    const tvPattern = /S\d{1,2}E\d{1,2}|\d{1,2}x\d{1,2}/i
    if (tvPattern.test(folderName)) {
      return 'tv'
    }
    return 'movies'
  }

  if (audioCount > 0 && audioCount >= videoCount && audioCount >= bookCount) {
    return 'music'
  }

  if (bookCount > 0) {
    return 'books'
  }

  return null
}

// Replicate parseTitleAndYear from FolderScanner
function parseTitleAndYear(folderName: string): { title: string; year?: number } {
  let cleaned = folderName
    .replace(/-xpost$/i, '')
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .trim()

  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/)
  const year = yearMatch ? Number.parseInt(yearMatch[1]) : undefined

  const titleMatch = cleaned.match(
    /^(.+?)(?:\s+(?:REMASTERED|COMPLETE|EXTENDED|DIRECTORS|UNCUT|THEATRICAL|PROPER|RERIP|BLURAY|BLU-RAY|BDRIP|HDRIP|DVDRIP|WEBRIP|WEB-DL|HDTV|720p|1080p|2160p|4K|UHD|x264|x265|HEVC|H\.?264|H\.?265|AAC|DTS|AC3|ATMOS|REMUX|NF|AMZN|DSNP|ATVP))/i
  )

  let title: string
  if (titleMatch) {
    title = titleMatch[1].replace(/\b\d{4}\b/, '').trim()
  } else {
    title = cleaned.split(/\s+\d{4}\s+|\s+-\s+/)[0].trim()
  }

  return { title, year }
}

// Replicate generateSortTitle from FolderScanner
function generateSortTitle(title: string): string {
  const articles = ['the ', 'a ', 'an ']
  const lowerTitle = title.toLowerCase()
  for (const article of articles) {
    if (lowerTitle.startsWith(article)) {
      return title.substring(article.length)
    }
  }
  return title
}

// Replicate generateSortName from FolderScanner
function generateSortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  const last = parts.pop()!
  return `${last}, ${parts.join(' ')}`
}

// Replicate isSimilar and levenshteinDistance from FolderScanner
function levenshteinDistance(a: string, b: string): number {
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

function isSimilar(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true
  if (a.length < 20 && b.length < 20) {
    const distance = levenshteinDistance(a, b)
    const maxLength = Math.max(a.length, b.length)
    return distance / maxLength < 0.3
  }
  return false
}

// Replicate mapTmdbStatus from FolderScanner
function mapTmdbStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Returning Series': 'continuing',
    'In Production': 'continuing',
    'Planned': 'upcoming',
    'Ended': 'ended',
    'Canceled': 'ended',
    'Pilot': 'upcoming',
  }
  return statusMap[status] || 'unknown'
}

// --- Tests ---

test.group('FolderScanner | detectMediaType', () => {
  test('detects movies from video files', ({ assert }) => {
    const files = ['movie.mkv', 'sample.nfo', 'poster.jpg']
    assert.equal(detectMediaTypeFromFiles(files, 'The.Matrix.1999.1080p.BluRay'), 'movies')
  })

  test('detects tv from video files with S01E01 pattern', ({ assert }) => {
    const files = ['episode.mkv']
    assert.equal(
      detectMediaTypeFromFiles(files, 'Breaking.Bad.S01E01.720p.BluRay'),
      'tv'
    )
  })

  test('detects tv from video files with 1x01 pattern', ({ assert }) => {
    const files = ['episode.mp4']
    assert.equal(detectMediaTypeFromFiles(files, 'Seinfeld.1x01'), 'tv')
  })

  test('detects music from audio files', ({ assert }) => {
    const files = ['01-track.flac', '02-track.flac', '03-track.flac', 'cover.jpg']
    assert.equal(
      detectMediaTypeFromFiles(files, 'Pink Floyd - Dark Side of the Moon FLAC'),
      'music'
    )
  })

  test('detects books from book files', ({ assert }) => {
    const files = ['book.epub', 'cover.jpg']
    assert.equal(
      detectMediaTypeFromFiles(files, 'Stephen King - The Shining epub'),
      'books'
    )
  })

  test('returns null when no media files found', ({ assert }) => {
    const files = ['readme.txt', 'notes.doc']
    assert.isNull(detectMediaTypeFromFiles(files, 'random_folder'))
  })

  test('video wins over audio when both present equally', ({ assert }) => {
    const files = ['movie.mkv', 'soundtrack.flac']
    assert.equal(detectMediaTypeFromFiles(files, 'Some.Movie.2024'), 'movies')
  })

  test('audio wins when more audio files than video', ({ assert }) => {
    const files = ['01.flac', '02.flac', '03.flac', 'video.mkv']
    assert.equal(detectMediaTypeFromFiles(files, 'Artist - Album'), 'music')
  })

  test('detects multiple video extensions', ({ assert }) => {
    assert.equal(detectMediaTypeFromFiles(['file.mp4'], 'Movie 2024'), 'movies')
    assert.equal(detectMediaTypeFromFiles(['file.avi'], 'Movie 2024'), 'movies')
    assert.equal(detectMediaTypeFromFiles(['file.m4v'], 'Movie 2024'), 'movies')
  })

  test('detects multiple book extensions', ({ assert }) => {
    assert.equal(detectMediaTypeFromFiles(['book.mobi'], 'Book epub'), 'books')
    assert.equal(detectMediaTypeFromFiles(['book.pdf'], 'Book pdf'), 'books')
    assert.equal(detectMediaTypeFromFiles(['book.azw3'], 'Book ebook'), 'books')
  })
})

test.group('FolderScanner | parseTitleAndYear', () => {
  test('parses simple movie title with year', ({ assert }) => {
    const result = parseTitleAndYear('The.Matrix.1999.1080p.BluRay')
    assert.equal(result.title, 'The Matrix')
    assert.equal(result.year, 1999)
  })

  test('parses movie with multiple quality tags', ({ assert }) => {
    const result = parseTitleAndYear('Inception.2010.2160p.UHD.BluRay.x265.HEVC')
    assert.equal(result.title, 'Inception')
    assert.equal(result.year, 2010)
  })

  test('parses movie with web-dl source', ({ assert }) => {
    const result = parseTitleAndYear('Dune.Part.Two.2024.WEB-DL.1080p')
    assert.equal(result.title, 'Dune Part Two')
    assert.equal(result.year, 2024)
  })

  test('parses title with underscores', ({ assert }) => {
    const result = parseTitleAndYear('The_Matrix_1999_1080p_BluRay')
    assert.equal(result.title, 'The Matrix')
    assert.equal(result.year, 1999)
  })

  test('parses title without year', ({ assert }) => {
    const result = parseTitleAndYear('Some.Movie.BluRay')
    assert.equal(result.title, 'Some Movie')
    assert.isUndefined(result.year)
  })

  test('removes -xpost suffix', ({ assert }) => {
    const result = parseTitleAndYear('Movie.2024.1080p-xpost')
    assert.equal(result.title, 'Movie')
    assert.equal(result.year, 2024)
  })

  test('parses remastered edition', ({ assert }) => {
    const result = parseTitleAndYear('Blade.Runner.1982.REMASTERED.1080p.BluRay')
    assert.equal(result.title, 'Blade Runner')
    assert.equal(result.year, 1982)
  })

  test('parses extended edition', ({ assert }) => {
    const result = parseTitleAndYear('Lord.of.the.Rings.2001.EXTENDED.1080p')
    assert.equal(result.title, 'Lord of the Rings')
    assert.equal(result.year, 2001)
  })
})

test.group('FolderScanner | generateSortTitle', () => {
  test('removes leading "The"', ({ assert }) => {
    assert.equal(generateSortTitle('The Matrix'), 'Matrix')
  })

  test('removes leading "A"', ({ assert }) => {
    assert.equal(generateSortTitle('A Clockwork Orange'), 'Clockwork Orange')
  })

  test('removes leading "An"', ({ assert }) => {
    assert.equal(generateSortTitle('An Officer and a Gentleman'), 'Officer and a Gentleman')
  })

  test('does not modify titles without articles', ({ assert }) => {
    assert.equal(generateSortTitle('Inception'), 'Inception')
  })

  test('is case insensitive', ({ assert }) => {
    assert.equal(generateSortTitle('the matrix'), 'matrix')
  })
})

test.group('FolderScanner | generateSortName', () => {
  test('converts "First Last" to "Last, First"', ({ assert }) => {
    assert.equal(generateSortName('Stephen King'), 'King, Stephen')
  })

  test('handles multiple names', ({ assert }) => {
    assert.equal(generateSortName('J. R. R. Tolkien'), 'Tolkien, J. R. R.')
  })

  test('returns single name unchanged', ({ assert }) => {
    assert.equal(generateSortName('Madonna'), 'Madonna')
  })
})

test.group('FolderScanner | isSimilar', () => {
  test('matches identical strings', ({ assert }) => {
    assert.isTrue(isSimilar('thematrix', 'thematrix'))
  })

  test('matches when one contains the other', ({ assert }) => {
    assert.isTrue(isSimilar('thematrix1999', 'thematrix'))
  })

  test('matches with small levenshtein distance', ({ assert }) => {
    assert.isTrue(isSimilar('thematrix', 'thematix')) // 1 char difference
  })

  test('rejects significantly different strings', ({ assert }) => {
    assert.isFalse(isSimilar('inception', 'thematrix'))
  })

  test('handles empty strings', ({ assert }) => {
    assert.isTrue(isSimilar('test', '')) // empty is contained in anything
  })
})

test.group('FolderScanner | mapTmdbStatus', () => {
  test('maps Returning Series to continuing', ({ assert }) => {
    assert.equal(mapTmdbStatus('Returning Series'), 'continuing')
  })

  test('maps In Production to continuing', ({ assert }) => {
    assert.equal(mapTmdbStatus('In Production'), 'continuing')
  })

  test('maps Ended to ended', ({ assert }) => {
    assert.equal(mapTmdbStatus('Ended'), 'ended')
  })

  test('maps Canceled to ended', ({ assert }) => {
    assert.equal(mapTmdbStatus('Canceled'), 'ended')
  })

  test('maps Planned to upcoming', ({ assert }) => {
    assert.equal(mapTmdbStatus('Planned'), 'upcoming')
  })

  test('maps unknown status to unknown', ({ assert }) => {
    assert.equal(mapTmdbStatus('SomeOtherStatus'), 'unknown')
  })
})

test.group('FolderScanner | TV show folder name parsing', () => {
  test('parses S01E01 pattern', ({ assert }) => {
    const match = 'Breaking.Bad.S01E01.720p.BluRay'.match(
      /(.+?)[\s._-]*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i
    )
    assert.isNotNull(match)
    assert.equal(match![1].replace(/\./g, ' ').trim(), 'Breaking Bad')
    assert.equal(Number.parseInt(match![2]), 1)
    assert.equal(Number.parseInt(match![3]), 1)
  })

  test('parses 1x01 pattern', ({ assert }) => {
    const match = 'Seinfeld.1x01.The.Seinfeld.Chronicles'.match(
      /(.+?)[\s._-]*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i
    )
    assert.isNotNull(match)
    assert.equal(Number.parseInt(match![4]), 1)
    assert.equal(Number.parseInt(match![5]), 1)
  })

  test('parses multi-digit season and episode', ({ assert }) => {
    const match = 'Show.Name.S12E24.720p'.match(
      /(.+?)[\s._-]*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i
    )
    assert.isNotNull(match)
    assert.equal(Number.parseInt(match![2]), 12)
    assert.equal(Number.parseInt(match![3]), 24)
  })

  test('returns null for non-TV folder names', ({ assert }) => {
    const match = 'The.Matrix.1999.1080p'.match(
      /(.+?)[\s._-]*(?:S(\d{1,2})E(\d{1,2})|(\d{1,2})x(\d{1,2}))/i
    )
    assert.isNull(match)
  })
})

test.group('FolderScanner | music folder name parsing', () => {
  test('parses "Artist - Album" pattern', ({ assert }) => {
    const match = 'Pink Floyd - Dark Side of the Moon FLAC'.match(
      /^(.+?)\s*-\s*(.+?)(?:\s+(?:CD|LP|EP|FLAC|MP3|WEB|Vinyl|\d{4}).*)?$/i
    )
    assert.isNotNull(match)
    assert.equal(match![1].trim(), 'Pink Floyd')
    assert.equal(match![2].trim(), 'Dark Side of the Moon')
  })

  test('parses with year suffix', ({ assert }) => {
    const match = 'Radiohead - OK Computer 1997'.match(
      /^(.+?)\s*-\s*(.+?)(?:\s+(?:CD|LP|EP|FLAC|MP3|WEB|Vinyl|\d{4}).*)?$/i
    )
    assert.isNotNull(match)
    assert.equal(match![1].trim(), 'Radiohead')
    assert.equal(match![2].trim(), 'OK Computer')
  })

  test('parses with WEB source', ({ assert }) => {
    const match = 'Artist Name - Album Title WEB 2024'.match(
      /^(.+?)\s*-\s*(.+?)(?:\s+(?:CD|LP|EP|FLAC|MP3|WEB|Vinyl|\d{4}).*)?$/i
    )
    assert.isNotNull(match)
    assert.equal(match![1].trim(), 'Artist Name')
    assert.equal(match![2].trim(), 'Album Title')
  })
})

test.group('FolderScanner | book folder name parsing', () => {
  test('parses "Author - Title epub" pattern', ({ assert }) => {
    const dashMatch = 'Stephen King - The Shining epub'.match(
      /^(.+?)\s*-\s*(.+?)(?:\s+(?:epub|mobi|pdf).*)?$/i
    )
    assert.isNotNull(dashMatch)
    assert.equal(dashMatch![1].trim(), 'Stephen King')
    assert.equal(dashMatch![2].trim(), 'The Shining')
  })

  test('parses "Title by Author" pattern', ({ assert }) => {
    const byMatch = 'The Shining by Stephen King epub'.match(
      /^(.+?)\s+by\s+(.+?)(?:\s+(?:epub|mobi|pdf).*)?$/i
    )
    assert.isNotNull(byMatch)
    assert.equal(byMatch![1].trim(), 'The Shining')
    assert.equal(byMatch![2].trim(), 'Stephen King')
  })
})

test.group('FolderScanner | levenshteinDistance', () => {
  test('returns 0 for identical strings', ({ assert }) => {
    assert.equal(levenshteinDistance('test', 'test'), 0)
  })

  test('returns correct distance for single char difference', ({ assert }) => {
    assert.equal(levenshteinDistance('test', 'tset'), 2) // transposition = 2 ops
    assert.equal(levenshteinDistance('test', 'tes'), 1) // deletion
    assert.equal(levenshteinDistance('test', 'tests'), 1) // insertion
  })

  test('returns length for empty vs non-empty', ({ assert }) => {
    assert.equal(levenshteinDistance('', 'test'), 4)
    assert.equal(levenshteinDistance('test', ''), 4)
  })

  test('returns 0 for two empty strings', ({ assert }) => {
    assert.equal(levenshteinDistance('', ''), 0)
  })
})
