import path from 'node:path'
import Book from '#models/book'
import BookFile from '#models/book_file'
import { openLibraryService } from '#services/metadata/openlibrary_service'
import { readZipEntries } from '#utils/zip_entry'

/**
 * Which languages a book is in, as two-letter codes ("en", "de").
 *
 * Book rows arrive from OpenLibrary with no language, so it is worked out once
 * and stored in `books.language`: from the EPUB itself for books on disk (its
 * `dc:language`), from OpenLibrary's editions for everything else. `und`
 * (ISO 639 "undetermined") records a lookup that found nothing, so it is not
 * repeated.
 */

const UNDETERMINED = 'und'

/** OpenLibrary uses MARC codes; the rest of the world uses ISO 639-1. */
const MARC_TO_ISO: Record<string, string> = {
  eng: 'en',
  ger: 'de',
  deu: 'de',
  spa: 'es',
  fre: 'fr',
  fra: 'fr',
  ita: 'it',
  por: 'pt',
  dut: 'nl',
  nld: 'nl',
  swe: 'sv',
  nor: 'no',
  dan: 'da',
  fin: 'fi',
  pol: 'pl',
  rus: 'ru',
  jpn: 'ja',
  chi: 'zh',
  zho: 'zh',
  kor: 'ko',
  tur: 'tr',
  ara: 'ar',
  heb: 'he',
  gre: 'el',
  ell: 'el',
  cze: 'cs',
  ces: 'cs',
  hun: 'hu',
  rum: 'ro',
  ron: 'ro',
  ukr: 'uk',
  cat: 'ca',
}

export function normalizeLanguage(code: string | null | undefined): string | null {
  if (!code) return null
  const raw = code
    .trim()
    .toLowerCase()
    .replace(/^\/languages\//, '')
  if (!raw) return null
  const base = raw.split(/[-_]/)[0]
  if (base.length === 2) return base
  return MARC_TO_ISO[base] ?? null
}

/**
 * The most common words of each language a library is likely to hold. Enough
 * to tell them apart on a few pages of text; not a general language detector.
 */
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'it', 'was', 'for', 'with', 'you'],
  de: ['der', 'die', 'und', 'das', 'ist', 'nicht', 'ich', 'zu', 'den', 'mit', 'sich', 'auch'],
  nl: ['de', 'het', 'een', 'van', 'en', 'dat', 'niet', 'op', 'voor', 'zijn', 'met', 'ook'],
  es: ['el', 'la', 'de', 'que', 'y', 'en', 'los', 'se', 'del', 'las', 'por', 'una'],
  fr: ['le', 'la', 'les', 'de', 'et', 'des', 'est', 'que', 'une', 'pas', 'pour', 'dans'],
  it: ['il', 'di', 'che', 'la', 'e', 'per', 'non', 'un', 'una', 'sono', 'del', 'della'],
}

/**
 * Guess the language of a stretch of text from its commonest words. Returns
 * null unless one language clearly leads — a close call is no answer.
 */
export function guessLanguage(text: string): string | null {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  if (words.length < 150) return null
  const scores = Object.entries(STOPWORDS).map(([lang, list]) => {
    const set = new Set(list)
    return [lang, words.filter((w) => set.has(w)).length] as const
  })
  scores.sort((a, b) => b[1] - a[1])
  const [best, second] = scores
  if (best[1] < 20 || best[1] < second[1] * 1.5) return null
  return best[0]
}

const htmlToText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')

/**
 * The language of an EPUB: what a few pages of its text say, or else what its
 * metadata declares. The text wins because the metadata is often wrong — a
 * converter set to Dutch stamps `nl` on an English book.
 */
export async function readEpubLanguage(file: string): Promise<string | null> {
  const container = await readZipEntries(file, (n) => n === 'META-INF/container.xml')
  const containerXml = container.get('META-INF/container.xml')?.toString('utf8')
  const opfPath = containerXml && /full-path="([^"]+)"/.exec(containerXml)?.[1]
  let declared: string | null = null
  if (opfPath) {
    const opf = await readZipEntries(file, (n) => n === opfPath)
    const opfXml = opf.get(opfPath)?.toString('utf8') ?? ''
    declared = normalizeLanguage(/<dc:language[^>]*>\s*([^<\s]+)\s*</i.exec(opfXml)?.[1])
  }

  const pages = await readZipEntries(
    file,
    (n) => /\.x?html?$/i.test(n) && !/(cover|toc|nav|title|copyright)/i.test(n),
    12
  )
  const text = [...pages.values()].map((b) => htmlToText(b.toString('utf8'))).join(' ')
  return guessLanguage(text.slice(0, 40_000)) ?? declared
}

const titleKey = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/**
 * The language of an OpenLibrary work: the editions whose title matches the
 * book's decide it, and failing those, the language most editions share.
 */
async function lookupWorkLanguage(workId: string, title: string): Promise<string | null> {
  const editions = await openLibraryService.getWorkEditions(workId)
  const vote = (list: typeof editions) => {
    const counts = new Map<string, number>()
    for (const e of list) {
      for (const l of e.languages) {
        const iso = normalizeLanguage(l)
        if (iso) counts.set(iso, (counts.get(iso) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }
  const wanted = titleKey(title)
  return vote(editions.filter((e) => titleKey(e.title) === wanted)) ?? vote(editions)
}

class BookLanguages {
  /**
   * The languages of the books the user has on disk — the EPUBs say — or has
   * requested. Empty when nothing is known, which means "do not filter".
   */
  async owned(): Promise<Set<string>> {
    const books = await Book.query()
      .where((q) => q.where('hasFile', true).orWhere('requested', true))
      .preload('author', (q) => q.preload('rootFolder'))
    const languages = new Set<string>()

    for (const book of books) {
      let language = book.language
      if (!language && book.hasFile) {
        language = (await this.fromFile(book)) ?? UNDETERMINED
        book.language = language
        await book.save()
      }
      const iso = normalizeLanguage(language)
      if (iso && language !== UNDETERMINED) languages.add(iso)
    }
    return languages
  }

  private async fromFile(book: Book): Promise<string | null> {
    const files = await BookFile.query().where('bookId', book.id)
    const root = book.author?.rootFolder?.path
    if (!root) return null
    for (const file of files) {
      if (!file.relativePath.toLowerCase().endsWith('.epub')) continue
      const full = path.isAbsolute(file.relativePath)
        ? file.relativePath
        : path.join(root, file.relativePath)
      const language = await readEpubLanguage(full).catch(() => null)
      if (language) return language
    }
    return null
  }

  /** A suggested book's language, looked up once and then stored. */
  async of(book: {
    id: string
    title: string
    language: string | null
    openlibrary_id: string | null
  }): Promise<string | null> {
    if (book.language) return book.language === UNDETERMINED ? null : book.language
    if (!book.openlibrary_id) return null
    const found = await lookupWorkLanguage(book.openlibrary_id, book.title).catch(() => undefined)
    // A failed lookup (network) is retried next time; an empty answer is not.
    if (found === undefined) return null
    await Book.query()
      .where('id', book.id)
      .update({ language: found ?? UNDETERMINED })
    return found
  }
}

export const bookLanguages = new BookLanguages()
