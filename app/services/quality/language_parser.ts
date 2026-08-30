/**
 * Language parser
 *
 * The quality rules already answer "is this a good copy". They cannot answer
 * "is it a copy I can watch" — and for anyone outside the English-speaking
 * world that is the question that actually decides a grab. A flawless 2160p
 * Remux with a TrueHD 7.1 track is worthless if the only track is Italian.
 *
 * Two sources of truth, and they are not equally trustworthy:
 *
 *  1. The *release title*. Scene naming for languages is a folklore, not a
 *     standard: GERMAN.DL means German plus original, MULTi means "several,
 *     unspecified", VOSTFR means the audio is *not* French. So the title tells
 *     us something, often, and lies by omission the rest of the time.
 *  2. The *file*, via ffprobe stream tags. There a track either carries an
 *     ISO 639-2 tag or it does not, and untagged is common enough that silence
 *     still cannot be read as absence.
 *
 * Both paths funnel into the same ISO 639-1 codes so a profile rule is written
 * once and means the same thing before and after the download.
 */

/** ISO 639-1, lowercase. The one identity a language has across both paths. */
export type LanguageCode = string

export interface LanguageDefinition {
  code: LanguageCode
  name: string
  /**
   * Tokens as they appear in release titles. Deliberately verbose over clever:
   * a bare two-letter code in a release name is far more likely to be part of
   * a group tag than a language, so almost nothing here is shorter than three
   * characters.
   */
  pattern: RegExp
  /** ISO 639-2/T and /B codes, which is what ffprobe hands back. */
  tags: string[]
}

/**
 * The languages worth having. Not the ISO register — the set that actually
 * turns up in release names and in the audio tracks of a home library, which
 * is what keeps the picker in settings scannable.
 */
export const LANGUAGES: LanguageDefinition[] = [
  {
    code: 'en',
    name: 'English',
    pattern: /\benglish\b|\beng\b/i,
    tags: ['eng', 'en'],
  },
  {
    code: 'de',
    name: 'German',
    pattern: /\bgerman\b|\bdeutsch\b|\bger\b|\bdeu\b/i,
    tags: ['ger', 'deu', 'de'],
  },
  {
    code: 'fr',
    name: 'French',
    pattern: /\bfrench\b|\btrue[\s._-]?french\b|\bfra\b|\bfre\b|\bvff\b|\bvfq\b|\bvfi\b/i,
    tags: ['fre', 'fra', 'fr'],
  },
  {
    code: 'es',
    name: 'Spanish',
    pattern: /\bspanish\b|\bcastellano\b|\bespanol\b|\bspa\b|\besp\b/i,
    tags: ['spa', 'es'],
  },
  {
    code: 'it',
    name: 'Italian',
    pattern: /\bitalian\b|\bitaliano\b|\bita\b/i,
    tags: ['ita', 'it'],
  },
  {
    code: 'pt',
    name: 'Portuguese',
    pattern: /\bportuguese\b|\bportugues\b|\bpor\b|\bptbr\b|\bpt[\s._-]?br\b/i,
    tags: ['por', 'pt'],
  },
  {
    code: 'nl',
    name: 'Dutch',
    pattern: /\bdutch\b|\bnederlands\b|\bnld\b|\bdut\b/i,
    tags: ['dut', 'nld', 'nl'],
  },
  {
    code: 'da',
    name: 'Danish',
    pattern: /\bdanish\b|\bdansk\b|\bdan\b/i,
    tags: ['dan', 'da'],
  },
  {
    code: 'sv',
    name: 'Swedish',
    pattern: /\bswedish\b|\bsvenska\b|\bswe\b/i,
    tags: ['swe', 'sv'],
  },
  {
    code: 'no',
    name: 'Norwegian',
    pattern: /\bnorwegian\b|\bnorsk\b|\bnor\b/i,
    tags: ['nor', 'nob', 'nno', 'no'],
  },
  {
    code: 'fi',
    name: 'Finnish',
    pattern: /\bfinnish\b|\bsuomi\b|\bfin\b/i,
    tags: ['fin', 'fi'],
  },
  {
    code: 'is',
    name: 'Icelandic',
    pattern: /\bicelandic\b|\bisl\b/i,
    tags: ['ice', 'isl', 'is'],
  },
  {
    code: 'pl',
    name: 'Polish',
    pattern: /\bpolish\b|\bpolski\b|\bpldub\b|\bpol\b/i,
    tags: ['pol', 'pl'],
  },
  {
    code: 'cs',
    name: 'Czech',
    pattern: /\bczech\b|\bcesky\b|\bcze\b|\bces\b/i,
    tags: ['cze', 'ces', 'cs'],
  },
  {
    code: 'sk',
    name: 'Slovak',
    pattern: /\bslovak\b|\bslo\b|\bslk\b/i,
    tags: ['slo', 'slk', 'sk'],
  },
  {
    code: 'hu',
    name: 'Hungarian',
    pattern: /\bhungarian\b|\bmagyar\b|\bhun\b/i,
    tags: ['hun', 'hu'],
  },
  {
    code: 'ro',
    name: 'Romanian',
    pattern: /\bromanian\b|\brum\b|\bron\b|\bron?a\b/i,
    tags: ['rum', 'ron', 'ro'],
  },
  {
    code: 'el',
    name: 'Greek',
    pattern: /\bgreek\b|\bell\b|\bgre\b/i,
    tags: ['gre', 'ell', 'el'],
  },
  {
    code: 'tr',
    name: 'Turkish',
    pattern: /\bturkish\b|\bturkce\b|\btur\b/i,
    tags: ['tur', 'tr'],
  },
  {
    code: 'ru',
    name: 'Russian',
    pattern: /\brussian\b|\brus\b/i,
    tags: ['rus', 'ru'],
  },
  {
    code: 'uk',
    name: 'Ukrainian',
    pattern: /\bukrainian\b|\bukr\b/i,
    tags: ['ukr', 'uk'],
  },
  {
    code: 'ja',
    name: 'Japanese',
    pattern: /\bjapanese\b|\bjpn\b|\bjap\b/i,
    tags: ['jpn', 'ja'],
  },
  {
    code: 'ko',
    name: 'Korean',
    pattern: /\bkorean\b|\bkor\b/i,
    tags: ['kor', 'ko'],
  },
  {
    code: 'zh',
    name: 'Chinese',
    pattern: /\bchinese\b|\bmandarin\b|\bcantonese\b|\bchi\b|\bzho\b|\bchs\b|\bcht\b/i,
    tags: ['chi', 'zho', 'cmn', 'yue', 'zh'],
  },
  {
    code: 'hi',
    name: 'Hindi',
    pattern: /\bhindi\b|\bhin\b/i,
    tags: ['hin', 'hi'],
  },
  {
    code: 'ta',
    name: 'Tamil',
    pattern: /\btamil\b|\btam\b/i,
    tags: ['tam', 'ta'],
  },
  {
    code: 'te',
    name: 'Telugu',
    pattern: /\btelugu\b|\btel\b/i,
    tags: ['tel', 'te'],
  },
  {
    code: 'ar',
    name: 'Arabic',
    pattern: /\barabic\b|\bara\b/i,
    tags: ['ara', 'ar'],
  },
  {
    code: 'he',
    name: 'Hebrew',
    pattern: /\bhebrew\b|\bheb\b/i,
    tags: ['heb', 'he'],
  },
  {
    code: 'th',
    name: 'Thai',
    pattern: /\bthai\b|\btha\b/i,
    tags: ['tha', 'th'],
  },
]

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]))

const BY_TAG = new Map<string, LanguageCode>(
  LANGUAGES.flatMap((language) => language.tags.map((tag) => [tag, language.code] as const))
)

/** Human name for a code, falling back to the code so unknown data still renders. */
export function languageName(code: LanguageCode): string {
  return BY_CODE.get(code)?.name ?? code.toUpperCase()
}

export function isKnownLanguage(code: string): boolean {
  return BY_CODE.has(code)
}

/**
 * "German and English", "German, English and French" — the phrasing rejection
 * messages and file summaries both want.
 */
export function describeLanguages(codes: LanguageCode[]): string {
  const names = codes.map(languageName)
  if (names.length === 0) return 'none'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Markers that describe *subtitles*, not audio.
 *
 * This is the distinction that makes naive language matching worse than none:
 * VOSTFR is a French release only in the sense that the subtitles are French —
 * the audio is deliberately the original. Match these first and cut them out,
 * so the language pass never sees the language name inside them.
 */
const SUBTITLE_MARKERS: { pattern: RegExp; codes: LanguageCode[] }[] = [
  { pattern: /\bvo?st[\s._-]?fr\b|\bvostfr\b/gi, codes: ['fr'] },
  { pattern: /\bvo?st[\s._-]?en\b|\bvosten\b/gi, codes: ['en'] },
  { pattern: /\beng?[\s._-]?subs?\b|\benglish[\s._-]?subs?\b/gi, codes: ['en'] },
  { pattern: /\bger[\s._-]?subs?\b|\bgerman[\s._-]?subs?\b/gi, codes: ['de'] },
  { pattern: /\bspa?[\s._-]?subs?\b|\bspanish[\s._-]?subs?\b/gi, codes: ['es'] },
  { pattern: /\bita[\s._-]?subs?\b|\bitalian[\s._-]?subs?\b/gi, codes: ['it'] },
  { pattern: /\bmulti[\s._-]?subs?\b|\bmsubs?\b|\besubs?\b|\bsubbed\b|\bhardsubs?\b/gi, codes: [] },
]

/** "Several languages, unspecified" — the scene's way of saying nothing useful. */
const MULTI_PATTERN = /\bmulti\b|\bmulti[\s._-]?audio\b|\bdual[\s._-]?audio\b|\bdual\b|\bnordic\b/i

/**
 * The German scene's DL: "Dual Language", meaning German plus the original.
 * It only carries that meaning next to a German marker — DL on its own is not
 * a claim about German, and elsewhere it is just two letters.
 */
const GERMAN_DUAL_PATTERN = /\bdl\b/i

const DUBBED_PATTERN = /\bdubbed\b|\bdub\b|\bsynced[\s._-]?dub\b/i

export interface ParsedLanguages {
  /** Languages the title claims are in the audio. Empty means it said nothing. */
  audio: LanguageCode[]
  /** Languages the title claims are only in the subtitles. */
  subtitles: LanguageCode[]
  /**
   * The release carries several audio tracks but does not say which. Never a
   * rejection on its own — it is the one case where a language rule has to
   * wait for the file.
   */
  isMulti: boolean
  /** The audio is a dub rather than the original recording. */
  isDubbed: boolean
}

/**
 * Where the movie or show name stops and the tags start: the year, the season
 * marker, a resolution or a source. Everything after this point is metadata.
 */
const TECHNICAL_MARKER =
  /\b(?:19|20)\d{2}\b|\bs\d{1,2}(?:e\d{1,3})?\b|\b(?:2160p|1080p|720p|480p|4k|uhd)\b|\b(?:blu[\s._-]?ray|bdrip|brrip|web[\s._-]?dl|webrip|web|hdtv|dvdrip|dvd|remux)\b/i

/**
 * The part of a title that may be talking about languages.
 *
 * Scanning the whole string cannot work: *The Italian Job*, *The French
 * Connection* and *Dan in Real Life* all name a language inside the film's own
 * title, and a rule that reads those as audio claims would reject exactly the
 * releases someone went looking for. So the name is cut away at the first
 * technical marker.
 *
 * The one token kept from the name side is the last one, because the German
 * scene puts the language immediately before the year —
 * `Der.Untergang.German.2004.1080p` — and dropping it would blind us to the
 * single most common language tag there is.
 */
function languageScanZone(title: string): string {
  const marker = title.match(TECHNICAL_MARKER)
  if (!marker || marker.index === undefined) return title

  const before = title.slice(0, marker.index)
  const after = title.slice(marker.index)
  const trailing =
    before
      .split(/[\s._-]+/)
      .filter(Boolean)
      .pop() ?? ''

  return `${trailing}.${after}`
}

/**
 * Read the language claims out of a release title.
 *
 * Nothing here is a guarantee. A title that says GERMAN is very probably
 * German; a title that says nothing is not evidence of anything, which is why
 * callers treat an empty result as unknown rather than as English.
 */
export function parseLanguages(rawTitle: string): ParsedLanguages {
  // Release names separate tokens with dots, spaces, hyphens or underscores,
  // and \b never matches around an underscore — the same trap the quality
  // parser documents. Normalise before anything else looks at the string.
  let title = languageScanZone(rawTitle.replace(/_/g, '.'))

  const subtitles: LanguageCode[] = []
  for (const marker of SUBTITLE_MARKERS) {
    // Reset lastIndex: these are module-level /g regexes, reused per call.
    marker.pattern.lastIndex = 0
    if (marker.pattern.test(title)) {
      for (const code of marker.codes) {
        if (!subtitles.includes(code)) subtitles.push(code)
      }
      marker.pattern.lastIndex = 0
      title = title.replace(marker.pattern, '.')
    }
  }

  const audio: LanguageCode[] = []
  for (const language of LANGUAGES) {
    if (language.pattern.test(title)) audio.push(language.code)
  }

  const isMulti = MULTI_PATTERN.test(title)

  // GERMAN.DL is German plus the original track, and the original is English
  // often enough that treating it as German-only rejects half of what a German
  // dual-language profile is asking for. Record the multi flag, not a guess at
  // which second language it is.
  const isGermanDual = audio.includes('de') && GERMAN_DUAL_PATTERN.test(title)

  return {
    audio,
    subtitles,
    isMulti: isMulti || isGermanDual,
    isDubbed: DUBBED_PATTERN.test(title),
  }
}

/**
 * Map an ffprobe stream tag to our code set.
 *
 * ffprobe reports whatever the muxer wrote: ISO 639-2/B ("ger"), /T ("deu"),
 * 639-1 ("de"), a BCP 47 tag ("de-DE"), or the placeholders "und" and "" that
 * mean the track was never tagged at all.
 */
export function normalizeLanguageTag(tag: string | null | undefined): LanguageCode | null {
  if (!tag) return null
  const cleaned = tag.trim().toLowerCase().split(/[-_]/)[0]
  if (!cleaned || cleaned === 'und' || cleaned === 'mis' || cleaned === 'zxx') return null
  return BY_TAG.get(cleaned) ?? (BY_CODE.has(cleaned) ? cleaned : null)
}
