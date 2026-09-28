import type { IconSvgElement } from '@hugeicons/react'
import { Book01Icon, MusicNote01Icon, Tv01Icon, Video01Icon } from '@hugeicons/core-free-icons'
import type { QualityRequirements } from '@/components/settings/quality-requirements-fields'
import type { ConnectedAccount } from '@/components/settings/account-connect'

/**
 * The shapes and fixed vocabularies behind Settings → Media, Quality and
 * Discovery. Pure data and formatting, tested directly (library_catalog.test.ts).
 */

export type MediaType = 'movies' | 'tv' | 'music' | 'books'

/** Canonical order: every list of types on these pages follows it. */
export const MEDIA_TYPES: readonly MediaType[] = ['movies', 'tv', 'music', 'books']

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === 'string' && (MEDIA_TYPES as readonly string[]).includes(value)
}

export interface MediaTypeInfo {
  label: string
  /** Lower case, for the middle of a sentence. */
  noun: string
  icon: IconSvgElement
  description: string
  /** Metadata comes from TMDB, so the type cannot be switched on without a key. */
  needsTmdbKey: boolean
}

export const MEDIA_TYPE_INFO: Record<MediaType, MediaTypeInfo> = {
  movies: {
    label: 'Movies',
    noun: 'movies',
    icon: Video01Icon,
    description: 'Films, with metadata from TMDB',
    needsTmdbKey: true,
  },
  tv: {
    label: 'TV shows',
    noun: 'TV shows',
    icon: Tv01Icon,
    description: 'Series, seasons and episodes from TMDB',
    needsTmdbKey: true,
  },
  music: {
    label: 'Music',
    noun: 'music',
    icon: MusicNote01Icon,
    description: 'Artists and albums from MusicBrainz',
    needsTmdbKey: false,
  },
  books: {
    label: 'Books',
    noun: 'books',
    icon: Book01Icon,
    description: 'Ebooks, with metadata from OpenLibrary',
    needsTmdbKey: false,
  },
}

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

/** GET /api/v1/rootfolders */
export interface RootFolder {
  id: string
  path: string
  name: string | null
  mediaType: MediaType
  accessible: boolean
}

export interface RecommendationSettings {
  simklEnabled: boolean
  personalizedEnabled: boolean
  maxPersonalizedLanes: number
  justwatchEnabled: boolean
}

export interface ConnectableAccount {
  id: string
  label: string
  configured: boolean
  account: ConnectedAccount | null
}

/** GET and PUT /api/v1/settings */
export interface AppSettings {
  enabledMediaTypes: MediaType[]
  hasTmdbApiKey: boolean
  simklClientId: string
  accounts: ConnectableAccount[]
  recommendationSettings: RecommendationSettings
  justwatchEnabled: boolean
  justwatchLocale: string
  selectedStreamingProviders: number[]
}

/**
 * What a page may send to PUT /api/v1/settings. The server stores each key it
 * is given and leaves the rest alone, so every page sends only its own.
 */
export interface AppSettingsPatch {
  tmdbApiKey?: string
  simklClientId?: string
  recommendationSettings?: RecommendationSettings
  justwatchEnabled?: boolean
  justwatchLocale?: string
  selectedStreamingProviders?: number[]
}

export const DEFAULT_RECOMMENDATIONS: RecommendationSettings = {
  simklEnabled: false,
  personalizedEnabled: false,
  maxPersonalizedLanes: 3,
  justwatchEnabled: false,
}

/** Fills the gaps an older install leaves in GET /api/v1/settings. */
export function normalizeSettings(data: Partial<AppSettings> | null | undefined): AppSettings {
  const types = Array.isArray(data?.enabledMediaTypes)
    ? data.enabledMediaTypes.filter(isMediaType)
    : []
  return {
    enabledMediaTypes: types,
    hasTmdbApiKey: Boolean(data?.hasTmdbApiKey),
    simklClientId: typeof data?.simklClientId === 'string' ? data.simklClientId : '',
    accounts: Array.isArray(data?.accounts) ? data.accounts : [],
    recommendationSettings: { ...DEFAULT_RECOMMENDATIONS, ...(data?.recommendationSettings ?? {}) },
    justwatchEnabled: Boolean(data?.justwatchEnabled),
    justwatchLocale: data?.justwatchLocale || 'en_US',
    selectedStreamingProviders: Array.isArray(data?.selectedStreamingProviders)
      ? data.selectedStreamingProviders
      : [],
  }
}

export interface TemplateVariable {
  name: string
  description: string
  example: string
}

/** GET /api/v1/settings/naming-patterns */
export interface NamingPatternsData {
  patterns: Record<MediaType, Record<string, string>>
  variables: Record<MediaType, Record<string, TemplateVariable[]>>
  examples: Record<MediaType, Record<string, string>>
}

export interface QualityItem {
  id: number
  name: string
  allowed: boolean
}

/** GET /api/v1/qualityprofiles */
export interface QualityProfile {
  id: string
  name: string
  mediaType: MediaType | null
  cutoff: number
  upgradeAllowed: boolean
  minSizeMb: number | null
  maxSizeMb: number | null
  items: QualityItem[]
  requirements: QualityRequirements | null
}

export interface StreamingProvider {
  id: number
  name: string
  logoPath: string
}

export type HardwareAccelType = 'auto' | 'videotoolbox' | 'cuda' | 'qsv' | 'vaapi' | 'none'

/** GET and PUT /api/v1/settings/playback */
export interface PlaybackSettings {
  transcoding: {
    useHardwareAcceleration: boolean
    hardwareAccelType: HardwareAccelType
  }
  availableHardwareAccel: string[]
}

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/**
 * Quality ids per media type. The server's parser uses the same ids
 * (app/services/quality/quality_parser.ts), so the two must move together.
 */
export const QUALITY_OPTIONS: Record<MediaType, { id: number; name: string }[]> = {
  movies: [
    { id: 1, name: 'Bluray 2160p' },
    { id: 2, name: 'Bluray 1080p' },
    { id: 3, name: 'Bluray 720p' },
    { id: 4, name: 'Web 2160p' },
    { id: 5, name: 'Web 1080p' },
    { id: 6, name: 'Web 720p' },
    { id: 7, name: 'HDTV 1080p' },
    { id: 8, name: 'HDTV 720p' },
    { id: 9, name: 'DVD' },
  ],
  tv: [
    { id: 1, name: 'Bluray 2160p' },
    { id: 2, name: 'Bluray 1080p' },
    { id: 3, name: 'Bluray 720p' },
    { id: 4, name: 'Web 2160p' },
    { id: 5, name: 'Web 1080p' },
    { id: 6, name: 'Web 720p' },
    { id: 7, name: 'HDTV 1080p' },
    { id: 8, name: 'HDTV 720p' },
    { id: 9, name: 'DVD' },
  ],
  music: [
    { id: 1, name: 'FLAC' },
    { id: 2, name: 'ALAC' },
    { id: 3, name: 'WAV' },
    { id: 4, name: 'MP3 320' },
    { id: 5, name: 'MP3 V0' },
    { id: 6, name: 'MP3 256' },
    { id: 7, name: 'MP3 192' },
    { id: 8, name: 'AAC 256' },
    { id: 9, name: 'OGG Vorbis' },
  ],
  books: [
    { id: 1, name: 'EPUB' },
    { id: 2, name: 'PDF' },
    { id: 3, name: 'MOBI' },
    { id: 4, name: 'AZW3' },
    { id: 5, name: 'CBZ' },
    { id: 6, name: 'CBR' },
  ],
}

/** JustWatch / TMDB watch-provider regions. */
export const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  en_US: 'United States',
  en_GB: 'United Kingdom',
  en_CA: 'Canada',
  en_AU: 'Australia',
  en_IN: 'India',
  de_DE: 'Germany',
  de_AT: 'Austria',
  de_CH: 'Switzerland',
  fr_FR: 'France',
  fr_BE: 'Belgium',
  es_ES: 'Spain',
  es_MX: 'Mexico',
  es_AR: 'Argentina',
  it_IT: 'Italy',
  nl_NL: 'Netherlands',
  pt_BR: 'Brazil',
  pt_PT: 'Portugal',
  sv_SE: 'Sweden',
  da_DK: 'Denmark',
  nb_NO: 'Norway',
  fi_FI: 'Finland',
  pl_PL: 'Poland',
  cs_CZ: 'Czech Republic',
  hu_HU: 'Hungary',
  ro_RO: 'Romania',
  el_GR: 'Greece',
  tr_TR: 'Turkey',
  ja_JP: 'Japan',
  ko_KR: 'South Korea',
  zh_TW: 'Taiwan',
  zh_HK: 'Hong Kong',
  th_TH: 'Thailand',
  en_NZ: 'New Zealand',
  en_ZA: 'South Africa',
}

/** The region picker's options, alphabetical by country. */
export const REGION_OPTIONS = Object.entries(LOCALE_DISPLAY_NAMES)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function regionName(locale: string): string {
  return LOCALE_DISPLAY_NAMES[locale] ?? locale
}

export const NAMING_FIELD_LABELS: Record<string, string> = {
  artistFolder: 'Artist folder format',
  albumFolder: 'Album folder format',
  trackFile: 'Track file format',
  movieFolder: 'Movie folder format',
  movieFile: 'Movie file format',
  showFolder: 'Show folder format',
  seasonFolder: 'Season folder format',
  episodeFile: 'Episode file format',
  authorFolder: 'Author folder format',
  bookFile: 'Book file format',
}

export const HW_ACCEL_OPTIONS: { value: HardwareAccelType; label: string }[] = [
  { value: 'auto', label: 'Auto-detect (recommended)' },
  { value: 'videotoolbox', label: 'VideoToolbox (macOS)' },
  { value: 'cuda', label: 'CUDA (NVIDIA)' },
  { value: 'qsv', label: 'Quick Sync (Intel)' },
  { value: 'vaapi', label: 'VAAPI (Linux)' },
  { value: 'none', label: 'None (CPU only)' },
]

export const HW_ACCEL_NAMES: Record<string, string> = {
  videotoolbox: 'VideoToolbox',
  cuda: 'CUDA',
  qsv: 'Quick Sync',
  vaapi: 'VAAPI',
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * A pattern rendered with each variable's example value — the same thing the
 * server shows, computed locally so it follows the field as it is typed.
 */
export function renderPattern(variables: readonly TemplateVariable[], pattern: string): string {
  let result = pattern
  for (const variable of variables) {
    result = result.split(`{${variable.name}}`).join(variable.example)
  }
  return result
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s*\[\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "Movie Title (2024)/Movie Title (2024) - 1080p": every field of a type, joined as a path. */
export function renderPatternPath(
  naming: Pick<NamingPatternsData, 'variables'>,
  mediaType: MediaType,
  patterns: Record<string, string> | undefined
): string {
  if (!patterns) return ''
  return Object.entries(patterns)
    .map(([field, pattern]) => renderPattern(naming.variables[mediaType]?.[field] ?? [], pattern))
    .filter(Boolean)
    .join('/')
}

/** "750 MB", "2 GB", "1.5 GB". */
export function formatMegabytes(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${gb >= 10 ? Math.round(gb) : Number(gb.toFixed(1))} GB`
  }
  return `${Math.round(mb)} MB`
}

/** "2–15 GB", "≥ 700 MB", "≤ 4 GB", or null when unbounded. */
export function formatSizeBand(minMb: number | null, maxMb: number | null): string | null {
  const min = minMb && minMb > 0 ? minMb : null
  const max = maxMb && maxMb > 0 ? maxMb : null
  if (min !== null && max !== null) {
    const a = formatMegabytes(min)
    const b = formatMegabytes(max)
    const [aValue, aUnit] = a.split(' ')
    const [bValue, bUnit] = b.split(' ')
    return aUnit === bUnit ? `${aValue}–${bValue} ${bUnit}` : `${a}–${b}`
  }
  if (min !== null) return `≥ ${formatMegabytes(min)}`
  if (max !== null) return `≤ ${formatMegabytes(max)}`
  return null
}

/** The quality a profile stops upgrading at: its cutoff, else its best allowed quality. */
export function cutoffName(profile: Pick<QualityProfile, 'cutoff' | 'items'>): string | null {
  const byId = profile.items.find((item) => item.id === profile.cutoff)
  if (byId) return byId.name
  return profile.items.find((item) => item.allowed)?.name ?? null
}

/** "cutoff Bluray 1080p · upgrades on · 2–15 GB · min CF 10" as parts. */
export function profileSummary(profile: QualityProfile): string[] {
  const allowed = profile.items.filter((item) => item.allowed).length
  const cutoff = profile.upgradeAllowed ? cutoffName(profile) : null
  const minScore = profile.requirements?.minCustomFormatScore ?? 0
  return [
    `${allowed} of ${profile.items.length} qualities`,
    cutoff ? `cutoff ${cutoff}` : null,
    profile.upgradeAllowed ? 'upgrades on' : 'upgrades off',
    formatSizeBand(profile.minSizeMb, profile.maxSizeMb),
    minScore !== 0 ? `min CF ${minScore}` : null,
  ].filter((part): part is string => part !== null)
}

/** "/settings/quality?type=tv" — the Quality page scoped to one type. */
export function qualityUrl(type: MediaType): string {
  return `/settings/quality?type=${type}`
}

/** The ?type= of a Quality page URL, when it names a media type. */
export function typeFromUrl(url: string): MediaType | null {
  const query = url.split('#')[0].split('?')[1] ?? ''
  const type = new URLSearchParams(query).get('type')
  return isMediaType(type) ? type : null
}
