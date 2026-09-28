/**
 * Settings → Indexers: the shapes the page reads and the words it turns them
 * into. Tested directly (indexers_api.test.ts).
 */

/** GET /api/v1/indexers */
export interface Indexer {
  id: string
  name: string
  url: string
  apiKey: string
  categories: number[]
  enabled: boolean
  priority: number
}

/** GET /api/v1/prowlarr */
export interface ProwlarrConfig {
  configured: boolean
  id?: string
  url: string
  apiKey: string
  syncCategories: number[]
  enabled: boolean
}

/** GET /api/v1/prowlarr/status — a live read, loaded after the page. */
export interface ProwlarrStatus {
  configured: boolean
  enabled: boolean
  /** null when not configured. */
  reachable: boolean | null
  indexers: { total: number; enabled: number; usenet: number; torrent: number } | null
  error: string | null
  checkedAt: string
}

/** POST /api/v1/indexers/test and /api/v1/prowlarr/test */
export interface ConnectionTest {
  success: boolean
  version?: string
  error?: string
}

/** "indexer.example.com/newznab" — the URL without its scheme or trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '')
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * The Prowlarr row's second line after the URL: how many indexers Prowlarr
 * would search, or null while that is unknown.
 */
export function prowlarrIndexerLine(status: ProwlarrStatus | null): string | null {
  if (!status?.indexers) return null
  const { enabled, total, usenet, torrent } = status.indexers
  if (total === 0) return 'no indexers in Prowlarr'
  const parts = [plural(enabled, 'indexer')]
  if (usenet > 0 && torrent > 0) parts.push(`${usenet} usenet, ${torrent} torrent`)
  if (enabled < total) parts.push(`${total - enabled} off in Prowlarr`)
  return parts.join(' · ')
}

export type ProwlarrState = 'checking' | 'reachable' | 'unreachable' | 'paused' | 'empty'

/** Which badge the Prowlarr row wears. */
export function prowlarrState(
  config: Pick<ProwlarrConfig, 'enabled'>,
  status: ProwlarrStatus | null
): ProwlarrState {
  if (!config.enabled) return 'paused'
  if (!status) return 'checking'
  if (status.reachable === false) return 'unreachable'
  if (status.indexers && status.indexers.enabled === 0) return 'empty'
  return 'reachable'
}

/** Sentence-case validation for the indexer editor. Returns field → message. */
export function validateIndexer(draft: {
  name: string
  url: string
  apiKey: string
}): Partial<Record<'name' | 'url' | 'apiKey', string>> {
  const errors: Partial<Record<'name' | 'url' | 'apiKey', string>> = {}
  if (!draft.name.trim()) errors.name = 'Give it a name to tell it apart in search results.'
  if (!draft.url.trim()) {
    errors.url = 'The indexer URL is required.'
  } else if (!isHttpUrl(draft.url.trim())) {
    errors.url = 'Start with http:// or https://.'
  }
  if (!draft.apiKey.trim()) errors.apiKey = 'The API key is required.'
  return errors
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
