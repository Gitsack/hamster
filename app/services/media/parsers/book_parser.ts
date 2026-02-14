/**
 * Book file/folder parser
 *
 * Parses folder and file names to extract book information.
 * Supports various naming conventions:
 * - "Author Name/Book Title.epub"
 * - "Author Name/Book Title (2020).epub"
 * - "Author Name - Book Title.pdf"
 * - "Series Name #1 - Book Title.epub"
 * - "Book Title - Author Name.mobi"
 */

export interface ParsedBookInfo {
  title: string
  authorName?: string
  year?: number
  format: string
  seriesName?: string
  seriesPosition?: number
}

const BOOK_EXTENSIONS = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.fb2', '.djvu', '.cbz', '.cbr']

export class BookParser {
  /**
   * Parse a full relative path to extract book information
   * Expects formats like:
   * - "Author Name/Book Title.epub"
   * - "Author Name/Series Name/Book Title.epub"
   */
  parseFromPath(relativePath: string): ParsedBookInfo {
    const parts = relativePath.split('/').filter((p) => p.length > 0)

    if (parts.length >= 2) {
      // Author folder / Book file structure
      return this.parseAuthorBookStructure(parts)
    } else if (parts.length === 1) {
      // Single file - try to extract author from filename
      return this.parseFileName(parts[0])
    }

    return { title: 'Unknown', format: 'UNKNOWN' }
  }

  /**
   * Parse just a file name
   */
  parseFileName(fileName: string): ParsedBookInfo {
    const format = this.extractFormat(fileName)
    const cleanName = this.removeExtension(fileName)

    // Try to extract author from filename patterns
    const authorTitle = this.extractAuthorFromFileName(cleanName)

    // Extract year
    const yearResult = this.extractYear(authorTitle.title)

    // Extract series info
    const seriesInfo = this.extractSeriesInfo(yearResult.remaining)

    return {
      title: this.cleanTitle(seriesInfo.remaining),
      authorName: authorTitle.author,
      year: yearResult.year,
      format,
      seriesName: seriesInfo.seriesName,
      seriesPosition: seriesInfo.seriesPosition,
    }
  }

  /**
   * Parse Author/Book structure
   */
  private parseAuthorBookStructure(parts: string[]): ParsedBookInfo {
    const fileName = parts[parts.length - 1]
    const authorFolder = parts[0]

    const format = this.extractFormat(fileName)
    const cleanName = this.removeExtension(fileName)

    // Extract year from filename
    const yearResult = this.extractYear(cleanName)

    // Extract series info
    const seriesInfo = this.extractSeriesInfo(yearResult.remaining)

    // Use folder as author name
    const authorName = this.cleanAuthorName(authorFolder)

    return {
      title: this.cleanTitle(seriesInfo.remaining),
      authorName,
      year: yearResult.year,
      format,
      seriesName: seriesInfo.seriesName,
      seriesPosition: seriesInfo.seriesPosition,
    }
  }

  private extractFormat(fileName: string): string {
    const lowerName = fileName.toLowerCase()
    for (const ext of BOOK_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        return ext.slice(1).toUpperCase()
      }
    }
    return 'UNKNOWN'
  }

  private removeExtension(name: string): string {
    const lowerName = name.toLowerCase()
    for (const ext of BOOK_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        return name.slice(0, -ext.length)
      }
    }
    return name
  }

  /**
   * Try to extract author from filename patterns like:
   * - "Author Name - Book Title"
   * - "Book Title - Author Name" (less common but supported)
   */
  private extractAuthorFromFileName(name: string): { author?: string; title: string } {
    // Pattern: "Author Name - Book Title"
    const dashMatch = name.match(/^(.+?)\s+-\s+(.+)$/)
    if (dashMatch) {
      const [, first, second] = dashMatch
      // Heuristic: if first part looks like a name (2-3 words, no numbers), it's probably the author
      if (this.looksLikeAuthorName(first) && !this.looksLikeAuthorName(second)) {
        return { author: first.trim(), title: second.trim() }
      }
      // Otherwise, assume "Book Title - Author Name" format
      if (this.looksLikeAuthorName(second)) {
        return { author: second.trim(), title: first.trim() }
      }
    }

    // No clear author pattern found
    return { title: name }
  }

  /**
   * Check if a string looks like an author name
   */
  private looksLikeAuthorName(str: string): boolean {
    const trimmed = str.trim()

    // Typically 2-4 words
    const words = trimmed.split(/\s+/)
    if (words.length < 1 || words.length > 5) {
      return false
    }

    // Shouldn't contain common book title words
    const bookTitleWords = [
      'the',
      'a',
      'an',
      'of',
      'and',
      'in',
      'to',
      'for',
      'book',
      'series',
      'volume',
      'vol',
      'part',
    ]
    const lowerWords = words.map((w) => w.toLowerCase())

    // If most words are title words, probably not an author
    const titleWordCount = lowerWords.filter((w) => bookTitleWords.includes(w)).length
    if (titleWordCount > words.length / 2) {
      return false
    }

    // Shouldn't contain numbers (unless roman numerals at end like "John Smith III")
    const hasNumbers = /\d/.test(trimmed)
    if (hasNumbers) {
      return false
    }

    return true
  }

  private extractYear(name: string): { year?: number; remaining: string } {
    const patterns = [/\((\d{4})\)/, /\[(\d{4})\]/]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        const year = Number.parseInt(match[1], 10)
        if (year >= 1800 && year <= 2099) {
          const remaining = name.replace(match[0], '').trim()
          return { year, remaining }
        }
      }
    }

    return { remaining: name }
  }

  /**
   * Extract series information from title
   * Patterns:
   * - "Series Name #1"
   * - "Series Name, Book 1"
   * - "Series Name (Book 1)"
   * - "[Series Name 1]"
   */
  private extractSeriesInfo(name: string): {
    seriesName?: string
    seriesPosition?: number
    remaining: string
  } {
    const patterns = [
      // "Series Name #1 - Book Title" or "Series Name #1: Book Title"
      /^(.+?)\s*#(\d+)\s*[-:]\s*(.+)$/,
      // "Series Name, Book 1 - Title"
      /^(.+?),\s*(?:Book|Vol\.?|Volume)\s*(\d+)\s*[-:]\s*(.+)$/i,
      // "[Series Name 1] Book Title"
      /^\[(.+?)\s*(\d+)\]\s*(.+)$/,
      // "Book Title (Series Name #1)"
      /^(.+?)\s*\((.+?)\s*#(\d+)\)$/,
      // "Book Title (Series Name, Book 1)"
      /^(.+?)\s*\((.+?),\s*(?:Book|Vol\.?|Volume)\s*(\d+)\)$/i,
    ]

    for (const pattern of patterns) {
      const match = name.match(pattern)
      if (match) {
        if (match.length === 4) {
          // Check which pattern matched based on structure
          if (pattern.source.startsWith('^\\(')) {
            // "(Series #1)" at end - match[1] is title, match[2] is series, match[3] is position
            return {
              seriesName: match[2].trim(),
              seriesPosition: Number.parseInt(match[3], 10),
              remaining: match[1].trim(),
            }
          } else {
            // Series info at start - match[1] is series, match[2] is position, match[3] is title
            return {
              seriesName: match[1].trim(),
              seriesPosition: Number.parseInt(match[2], 10),
              remaining: match[3].trim(),
            }
          }
        }
      }
    }

    // Try simple "#N" at the end
    const simpleMatch = name.match(/^(.+?)\s*#(\d+)$/)
    if (simpleMatch) {
      // This is likely "Series Name #1" without a separate book title
      // The series name IS the title in this case
      return {
        seriesPosition: Number.parseInt(simpleMatch[2], 10),
        remaining: simpleMatch[1].trim(),
      }
    }

    return { remaining: name }
  }

  private cleanTitle(title: string): string {
    // Remove common noise
    title = title.replace(/\s*[-:]\s*$/, '')
    title = title.replace(/^\s*[-:]\s*/, '')
    title = title.replace(/\s+/g, ' ')
    return title.trim() || 'Unknown'
  }

  private cleanAuthorName(name: string): string {
    // Remove common folder name noise
    let cleaned = name.replace(/\s+/g, ' ').trim()

    // Handle "Last, First" format - convert to "First Last"
    const commaMatch = cleaned.match(/^(.+?),\s*(.+)$/)
    if (commaMatch) {
      cleaned = `${commaMatch[2]} ${commaMatch[1]}`
    }

    return cleaned || 'Unknown'
  }
}

export const bookParser = new BookParser()
