/**
 * The language catalogue, mirroring LANGUAGES in the server's language parser.
 *
 * Only the code and the name cross the wire — the release-title patterns and
 * ISO 639-2 tags are parsing machinery and stay on the server. Order matches
 * the server list so a picker and a rejection message name languages in the
 * same sequence.
 */
export interface Language {
  code: string
  name: string
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'da', name: 'Danish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'is', name: 'Icelandic' },
  { code: 'pl', name: 'Polish' },
  { code: 'cs', name: 'Czech' },
  { code: 'sk', name: 'Slovak' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'ro', name: 'Romanian' },
  { code: 'el', name: 'Greek' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ar', name: 'Arabic' },
  { code: 'he', name: 'Hebrew' },
  { code: 'th', name: 'Thai' },
]

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]))

/** Human name for a code, falling back to the code so unknown data still renders. */
export function languageName(code: string): string {
  return BY_CODE.get(code)?.name ?? code.toUpperCase()
}

/** "DE", "EN" — the compact form for a badge with no room for a word. */
export function languageTag(code: string): string {
  return code.toUpperCase()
}

export function describeLanguages(codes: string[]): string {
  const names = codes.map(languageName)
  if (names.length === 0) return 'none'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
