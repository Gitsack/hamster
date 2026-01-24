import PQueue from 'p-queue'

const OPENLIBRARY_API = 'https://openlibrary.org'
const OPENLIBRARY_COVERS = 'https://covers.openlibrary.org'

// Rate limit: Be respectful, 1 request per 100ms
const queue = new PQueue({ interval: 100, intervalCap: 1 })

export interface OpenLibraryAuthor {
  key: string
  name: string
  birthDate?: string
  deathDate?: string
  bio?: string
  photoId?: number
}

export interface OpenLibraryBook {
  key: string
  title: string
  authorKey?: string
  authorName?: string
  firstPublishYear?: number
  isbn?: string[]
  numberOfPages?: number
  subjects?: string[]
  description?: string
  coverId?: number
}

export interface OpenLibrarySearchResult {
  key: string
  title: string
  authorName: string[]
  authorKey: string[]
  firstPublishYear?: number
  isbn?: string[]
  subject?: string[]
  coverId?: number
  editionCount: number
}

export class OpenLibraryService {
  private async fetch(url: string): Promise<any> {
    return queue.add(async () => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`OpenLibrary API error: ${response.status} ${response.statusText}`)
      }

      return response.json()
    })
  }

  // Search

  async searchBooks(query: string, limit = 20): Promise<OpenLibrarySearchResult[]> {
    const url = `${OPENLIBRARY_API}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`
    const data = await this.fetch(url)

    return data.docs.map((doc: any) => ({
      key: doc.key,
      title: doc.title,
      authorName: doc.author_name || [],
      authorKey: doc.author_key || [],
      firstPublishYear: doc.first_publish_year,
      isbn: doc.isbn?.slice(0, 5), // Limit ISBNs
      subject: doc.subject?.slice(0, 10), // Limit subjects
      coverId: doc.cover_i,
      editionCount: doc.edition_count || 0,
    }))
  }

  async searchAuthors(query: string, limit = 20): Promise<OpenLibraryAuthor[]> {
    const url = `${OPENLIBRARY_API}/search/authors.json?q=${encodeURIComponent(query)}&limit=${limit}`
    const data = await this.fetch(url)

    return data.docs.map((doc: any) => ({
      key: doc.key,
      name: doc.name,
      birthDate: doc.birth_date,
      deathDate: doc.death_date,
      bio: typeof doc.top_work === 'string' ? undefined : doc.bio,
    }))
  }

  // Get details

  async getAuthor(key: string): Promise<OpenLibraryAuthor | null> {
    try {
      const cleanKey = key.startsWith('/authors/') ? key : `/authors/${key}`
      const url = `${OPENLIBRARY_API}${cleanKey}.json`
      const data = await this.fetch(url)

      return {
        key: data.key,
        name: data.name,
        birthDate: data.birth_date,
        deathDate: data.death_date,
        bio: typeof data.bio === 'string' ? data.bio : data.bio?.value,
        photoId: data.photos?.[0],
      }
    } catch {
      return null
    }
  }

  async getAuthorWorks(authorKey: string, limit = 50): Promise<OpenLibraryBook[]> {
    try {
      const cleanKey = authorKey.startsWith('/authors/') ? authorKey : `/authors/${authorKey}`
      const url = `${OPENLIBRARY_API}${cleanKey}/works.json?limit=${limit}`
      const data = await this.fetch(url)

      return data.entries.map((work: any) => ({
        key: work.key,
        title: work.title,
        authorKey: authorKey,
        description:
          typeof work.description === 'string' ? work.description : work.description?.value,
        coverId: work.covers?.[0],
        subjects: work.subjects?.slice(0, 10),
      }))
    } catch {
      return []
    }
  }

  async getBook(key: string): Promise<OpenLibraryBook | null> {
    try {
      const cleanKey = key.startsWith('/works/') ? key : `/works/${key}`
      const url = `${OPENLIBRARY_API}${cleanKey}.json`
      const data = await this.fetch(url)

      return {
        key: data.key,
        title: data.title,
        authorKey: data.authors?.[0]?.author?.key,
        description:
          typeof data.description === 'string' ? data.description : data.description?.value,
        coverId: data.covers?.[0],
        subjects: data.subjects?.slice(0, 10),
      }
    } catch {
      return null
    }
  }

  async getBookEditions(workKey: string, limit = 20): Promise<any[]> {
    try {
      const cleanKey = workKey.startsWith('/works/') ? workKey : `/works/${workKey}`
      const url = `${OPENLIBRARY_API}${cleanKey}/editions.json?limit=${limit}`
      const data = await this.fetch(url)

      return data.entries.map((edition: any) => ({
        key: edition.key,
        title: edition.title,
        isbn10: edition.isbn_10?.[0],
        isbn13: edition.isbn_13?.[0],
        numberOfPages: edition.number_of_pages,
        publishDate: edition.publish_date,
        publishers: edition.publishers,
        coverId: edition.covers?.[0],
      }))
    } catch {
      return []
    }
  }

  // Image URLs

  getCoverUrl(coverId: number | undefined, size: 'S' | 'M' | 'L' = 'M'): string | null {
    if (!coverId) return null
    return `${OPENLIBRARY_COVERS}/b/id/${coverId}-${size}.jpg`
  }

  getAuthorPhotoUrl(photoId: number | undefined, size: 'S' | 'M' | 'L' = 'M'): string | null {
    if (!photoId) return null
    return `${OPENLIBRARY_COVERS}/a/id/${photoId}-${size}.jpg`
  }
}

export const openLibraryService = new OpenLibraryService()
