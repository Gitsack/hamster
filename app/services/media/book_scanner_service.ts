import fs from 'node:fs/promises'
import path from 'node:path'
import { DateTime } from 'luxon'
import { fileNamingService } from './file_naming_service.js'
import { bookParser, type ParsedBookInfo } from './parsers/book_parser.js'
import {
  openLibraryService,
  type OpenLibrarySearchResult,
} from '../metadata/openlibrary_service.js'
import RootFolder from '#models/root_folder'
import Author from '#models/author'
import Book from '#models/book'
import BookFile from '#models/book_file'

export interface ScanProgress {
  phase: 'discovering' | 'parsing' | 'metadata' | 'importing' | 'complete'
  total: number
  current: number
  currentItem?: string
}

export interface ScanResult {
  filesFound: number
  authorsCreated: number
  booksCreated: number
  booksUpdated: number
  unmatchedFiles: number
  errors: string[]
}

type ProgressCallback = (progress: ScanProgress) => void

interface ScannedBook {
  filePath: string
  relativePath: string
  parsed: ParsedBookInfo
  fileSize: number
}

interface GroupedAuthor {
  authorName: string
  books: ScannedBook[]
}

/**
 * Service for scanning book directories and creating library entries.
 */
export class BookScannerService {
  /**
   * Scan a root folder for books
   */
  async scanRootFolder(rootFolderId: string, onProgress?: ProgressCallback): Promise<ScanResult> {
    const rootFolder = await RootFolder.find(rootFolderId)
    if (!rootFolder) {
      return {
        filesFound: 0,
        authorsCreated: 0,
        booksCreated: 0,
        booksUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Root folder not found'],
      }
    }

    if (rootFolder.mediaType !== 'books') {
      return {
        filesFound: 0,
        authorsCreated: 0,
        booksCreated: 0,
        booksUpdated: 0,
        unmatchedFiles: 0,
        errors: ['Root folder is not configured for books'],
      }
    }

    return this.scanDirectory(rootFolder.path, rootFolder, onProgress)
  }

  /**
   * Scan a directory for book files
   */
  async scanDirectory(
    directory: string,
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<ScanResult> {
    const result: ScanResult = {
      filesFound: 0,
      authorsCreated: 0,
      booksCreated: 0,
      booksUpdated: 0,
      unmatchedFiles: 0,
      errors: [],
    }

    try {
      // Phase 1: Discover book files
      onProgress?.({ phase: 'discovering', total: 0, current: 0 })
      const bookFiles = await this.findBookFiles(directory)
      result.filesFound = bookFiles.length

      if (bookFiles.length === 0) {
        onProgress?.({ phase: 'complete', total: 0, current: 0 })
        return result
      }

      // Phase 2: Parse and group by author
      onProgress?.({ phase: 'parsing', total: bookFiles.length, current: 0 })
      const groupedAuthors = await this.parseAndGroupBooks(bookFiles, rootFolder, onProgress)

      // Phase 3: Process each author
      const authorCount = groupedAuthors.size
      let authorIndex = 0

      for (const [_authorKey, authorData] of groupedAuthors) {
        authorIndex++
        onProgress?.({
          phase: 'metadata',
          total: authorCount,
          current: authorIndex,
          currentItem: authorData.authorName,
        })

        try {
          const authorResult = await this.processAuthor(authorData, rootFolder)
          if (authorResult.authorCreated) result.authorsCreated++
          result.booksCreated += authorResult.booksCreated
          result.booksUpdated += authorResult.booksUpdated
          result.unmatchedFiles += authorResult.unmatchedFiles
        } catch (error) {
          result.errors.push(
            `${authorData.authorName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      onProgress?.({ phase: 'complete', total: result.filesFound, current: result.filesFound })
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Scan failed')
    }

    return result
  }

  /**
   * Find all book files recursively
   */
  private async findBookFiles(dir: string): Promise<string[]> {
    const results: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (this.shouldSkipFolder(entry.name)) continue
          const subFiles = await this.findBookFiles(fullPath)
          results.push(...subFiles)
        } else if (entry.isFile() && fileNamingService.isBookFile(entry.name)) {
          results.push(fullPath)
        }
      }
    } catch {
      // Ignore permission errors
    }

    return results
  }

  private shouldSkipFolder(name: string): boolean {
    const skipPatterns = [
      /^\./, // Hidden folders
      /^backup$/i,
      /^calibre$/i, // Calibre metadata folders
      /^__MACOSX$/,
    ]
    return skipPatterns.some((p) => p.test(name))
  }

  /**
   * Parse files and group by author
   */
  private async parseAndGroupBooks(
    files: string[],
    rootFolder: RootFolder,
    onProgress?: ProgressCallback
  ): Promise<Map<string, GroupedAuthor>> {
    const authorMap = new Map<string, GroupedAuthor>()

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      onProgress?.({
        phase: 'parsing',
        total: files.length,
        current: i + 1,
        currentItem: path.basename(filePath),
      })

      const relativePath = path.relative(rootFolder.path, filePath)
      const parsed = bookParser.parseFromPath(relativePath)
      const stats = await fs.stat(filePath)

      // Determine author name (from folder or parsed)
      const authorName = parsed.authorName || 'Unknown Author'
      const authorKey = this.normalizeAuthorName(authorName)

      if (!authorMap.has(authorKey)) {
        authorMap.set(authorKey, {
          authorName,
          books: [],
        })
      }

      authorMap.get(authorKey)!.books.push({
        filePath,
        relativePath,
        parsed,
        fileSize: stats.size,
      })
    }

    return authorMap
  }

  /**
   * Process an author and their books
   */
  private async processAuthor(
    authorData: GroupedAuthor,
    rootFolder: RootFolder
  ): Promise<{
    authorCreated: boolean
    booksCreated: number
    booksUpdated: number
    unmatchedFiles: number
  }> {
    let authorCreated = false
    let booksCreated = 0
    let booksUpdated = 0
    let unmatchedFiles = 0

    // Find or create author
    let author = await this.findExistingAuthor(authorData.authorName, rootFolder.id)

    if (!author) {
      // Try OpenLibrary lookup
      const olAuthor = await this.lookupOpenLibraryAuthor(authorData.authorName)

      if (olAuthor) {
        author = await this.createAuthorFromOpenLibrary(olAuthor, rootFolder.id)
      } else {
        author = await this.createAuthorFromParsed(authorData.authorName, rootFolder.id)
      }
      authorCreated = true
    }

    // Process each book
    for (const bookData of authorData.books) {
      try {
        const result = await this.processBook(bookData, author, rootFolder)
        if (result.created) booksCreated++
        else if (result.updated) booksUpdated++
        else if (result.unmatched) unmatchedFiles++
      } catch {
        unmatchedFiles++
      }
    }

    return { authorCreated, booksCreated, booksUpdated, unmatchedFiles }
  }

  /**
   * Process a single book
   */
  private async processBook(
    scanned: ScannedBook,
    author: Author,
    _rootFolder: RootFolder
  ): Promise<{ created: boolean; updated: boolean; unmatched: boolean }> {
    const { parsed, relativePath, fileSize } = scanned

    // Check if file already exists
    const existingFile = await BookFile.query().where('relativePath', relativePath).first()

    if (existingFile) {
      if (existingFile.sizeBytes === fileSize) {
        return { created: false, updated: false, unmatched: false }
      }
      existingFile.sizeBytes = fileSize
      await existingFile.save()
      return { created: false, updated: true, unmatched: false }
    }

    // Find or create book
    let book = await this.findExistingBook(parsed.title, author.id)

    if (!book) {
      // Try OpenLibrary lookup
      const olBook = await this.lookupOpenLibraryBook(parsed.title, author.name)

      if (olBook) {
        book = await this.createBookFromOpenLibrary(olBook, author)
      } else {
        book = await this.createBookFromParsed(parsed, author)
      }
    }

    // Create book file
    await BookFile.create({
      bookId: book.id,
      relativePath,
      sizeBytes: fileSize,
      format: parsed.format,
      dateAdded: DateTime.now(),
    })

    // Update book status
    book.hasFile = true
    await book.save()

    return { created: true, updated: false, unmatched: false }
  }

  /**
   * Find existing author
   */
  private async findExistingAuthor(name: string, rootFolderId: string): Promise<Author | null> {
    const normalizedName = this.normalizeAuthorName(name)

    // Try exact match
    let author = await Author.query()
      .where('rootFolderId', rootFolderId)
      .whereILike('name', name)
      .first()

    if (author) return author

    // Try normalized match
    const candidates = await Author.query().where('rootFolderId', rootFolderId).exec()

    for (const candidate of candidates) {
      if (this.normalizeAuthorName(candidate.name) === normalizedName) {
        return candidate
      }
    }

    return null
  }

  /**
   * Find existing book
   */
  private async findExistingBook(title: string, authorId: string): Promise<Book | null> {
    const normalizedTitle = this.normalizeTitle(title)

    // Try exact match
    let book = await Book.query().where('authorId', authorId).whereILike('title', title).first()

    if (book) return book

    // Try normalized match
    const candidates = await Book.query().where('authorId', authorId).exec()

    for (const candidate of candidates) {
      if (this.normalizeTitle(candidate.title) === normalizedTitle) {
        return candidate
      }
    }

    return null
  }

  private normalizeAuthorName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .trim()
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }

  /**
   * OpenLibrary author lookup
   */
  private async lookupOpenLibraryAuthor(name: string): Promise<any | null> {
    try {
      const results = await openLibraryService.searchAuthors(name, 5)
      if (results.length > 0) {
        // Find best match by name similarity
        const normalizedSearch = this.normalizeAuthorName(name)
        const match = results.find(
          (a) => this.normalizeAuthorName(a.name) === normalizedSearch
        )
        return match || results[0]
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * OpenLibrary book lookup
   */
  private async lookupOpenLibraryBook(
    title: string,
    authorName: string
  ): Promise<OpenLibrarySearchResult | null> {
    try {
      // Search with title and author
      const query = `${title} ${authorName}`
      const results = await openLibraryService.searchBooks(query, 10)

      if (results.length === 0) {
        // Try just title
        const titleResults = await openLibraryService.searchBooks(title, 10)
        return titleResults[0] || null
      }

      // Find best match
      const normalizedTitle = this.normalizeTitle(title)
      const normalizedAuthor = this.normalizeAuthorName(authorName)

      const match = results.find((b) => {
        const titleMatch = this.normalizeTitle(b.title) === normalizedTitle
        const authorMatch = b.authorName.some(
          (a) => this.normalizeAuthorName(a) === normalizedAuthor
        )
        return titleMatch && authorMatch
      })

      return match || results[0]
    } catch {
      return null
    }
  }

  /**
   * Create author from OpenLibrary data
   */
  private async createAuthorFromOpenLibrary(
    olAuthor: any,
    rootFolderId: string
  ): Promise<Author> {
    return Author.create({
      name: olAuthor.name,
      sortName: this.generateSortName(olAuthor.name),
      openlibraryId: olAuthor.key,
      imageUrl: openLibraryService.getAuthorPhotoUrl(olAuthor.photoId, 'L'),
      requested: false,
      needsReview: false,
      rootFolderId,
      addedAt: DateTime.now(),
    })
  }

  /**
   * Create author from parsed info
   */
  private async createAuthorFromParsed(name: string, rootFolderId: string): Promise<Author> {
    return Author.create({
      name,
      sortName: this.generateSortName(name),
      requested: false,
      needsReview: true,
      rootFolderId,
      addedAt: DateTime.now(),
    })
  }

  /**
   * Create book from OpenLibrary data
   */
  private async createBookFromOpenLibrary(
    olBook: OpenLibrarySearchResult,
    author: Author
  ): Promise<Book> {
    return Book.create({
      authorId: author.id,
      title: olBook.title,
      sortTitle: this.generateSortTitle(olBook.title),
      openlibraryId: olBook.key,
      isbn: olBook.isbn?.[0] || null,
      releaseDate: olBook.firstPublishYear
        ? DateTime.fromObject({ year: olBook.firstPublishYear })
        : null,
      coverUrl: openLibraryService.getCoverUrl(olBook.coverId, 'L'),
      genres: olBook.subject?.slice(0, 5) || [],
      requested: false,
      hasFile: false,
      addedAt: DateTime.now(),
    })
  }

  /**
   * Create book from parsed info
   */
  private async createBookFromParsed(parsed: ParsedBookInfo, author: Author): Promise<Book> {
    return Book.create({
      authorId: author.id,
      title: parsed.title,
      sortTitle: this.generateSortTitle(parsed.title),
      releaseDate: parsed.year ? DateTime.fromObject({ year: parsed.year }) : null,
      seriesName: parsed.seriesName,
      seriesPosition: parsed.seriesPosition,
      requested: false,
      hasFile: false,
      addedAt: DateTime.now(),
      genres: [],
    })
  }

  /**
   * Generate sort name for author (Last, First)
   */
  private generateSortName(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length <= 1) return name

    // Handle "First Last" -> "Last, First"
    const last = parts.pop()!
    return `${last}, ${parts.join(' ')}`
  }

  /**
   * Generate sort title (remove leading articles)
   */
  private generateSortTitle(title: string): string {
    const articles = ['the ', 'a ', 'an ']
    const lowerTitle = title.toLowerCase()

    for (const article of articles) {
      if (lowerTitle.startsWith(article)) {
        return title.substring(article.length)
      }
    }

    return title
  }
}

export const bookScannerService = new BookScannerService()
