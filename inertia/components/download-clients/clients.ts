/**
 * Settings → Download clients: the shapes the page reads and the pure rules
 * that turn them into a row's status. Tested directly (clients.test.ts).
 */
import type { ClientHealth } from '@/components/system/system_api'

export type DownloadClientType = 'sabnzbd' | 'nzbget' | 'qbittorrent' | 'transmission' | 'deluge'

/** GET /api/v1/downloadclients */
export interface DownloadClient {
  id: string
  name: string
  type: DownloadClientType
  host: string
  port: number
  apiKey: string
  username: string
  password: string
  useSsl: boolean
  category: string
  urlBase: string
  downloadDirectory: string
  addPaused: boolean
  enabled: boolean
  priority: number
  removeCompletedDownloads: boolean
  removeFailedDownloads: boolean
  remotePath: string
  localPath: string
  remoteTempPath: string
  localTempPath: string
}

/** Everything the editor sends; fields it has no control for travel through unchanged. */
export type ClientDraft = Omit<DownloadClient, 'id'>

/** POST /api/v1/downloadclients/test */
export interface ClientTestResult {
  success: boolean
  version?: string
  error?: string
  /** The client's complete folder, as the client sees it. */
  remotePath?: string
  /** Hamster can read `remotePath` as is, so no mapping is needed. */
  pathAccessible?: boolean
  remoteTempPath?: string
}

interface ClientTypeInfo {
  label: string
  protocol: 'usenet' | 'torrent'
  defaultPort: number
  /** Which credentials the client takes. */
  credentials: 'apiKey' | 'userPassword' | 'password'
  /** A username is required rather than optional. */
  usernameRequired?: boolean
  urlBase?: boolean
}

export const CLIENT_TYPES: Record<DownloadClientType, ClientTypeInfo> = {
  sabnzbd: { label: 'SABnzbd', protocol: 'usenet', defaultPort: 8080, credentials: 'apiKey' },
  nzbget: {
    label: 'NZBGet',
    protocol: 'usenet',
    defaultPort: 6789,
    credentials: 'userPassword',
    usernameRequired: true,
  },
  qbittorrent: {
    label: 'qBittorrent',
    protocol: 'torrent',
    defaultPort: 8080,
    credentials: 'userPassword',
  },
  transmission: {
    label: 'Transmission',
    protocol: 'torrent',
    defaultPort: 9091,
    credentials: 'userPassword',
    urlBase: true,
  },
  deluge: { label: 'Deluge', protocol: 'torrent', defaultPort: 8112, credentials: 'password' },
}

export const CLIENT_TYPE_ORDER: DownloadClientType[] = [
  'sabnzbd',
  'nzbget',
  'qbittorrent',
  'transmission',
  'deluge',
]

export function clientTypeInfo(type: string): ClientTypeInfo {
  return CLIENT_TYPES[type as DownloadClientType] ?? CLIENT_TYPES.sabnzbd
}

export const DEFAULT_DRAFT: ClientDraft = {
  name: '',
  type: 'sabnzbd',
  host: 'localhost',
  port: 8080,
  apiKey: '',
  username: '',
  password: '',
  useSsl: false,
  category: '',
  urlBase: '',
  downloadDirectory: '',
  addPaused: false,
  enabled: true,
  priority: 1,
  removeCompletedDownloads: true,
  removeFailedDownloads: true,
  remotePath: '',
  localPath: '',
  remoteTempPath: '',
  localTempPath: '',
}

export function draftFromClient(client: DownloadClient | null): ClientDraft {
  if (!client) return { ...DEFAULT_DRAFT }
  const rest: Partial<DownloadClient> = { ...client }
  delete rest.id
  // Older rows can miss optional strings; the inputs want ''.
  return {
    ...DEFAULT_DRAFT,
    ...rest,
    apiKey: rest.apiKey || '',
    username: rest.username || '',
    password: rest.password || '',
    category: rest.category || '',
    urlBase: rest.urlBase || '',
    downloadDirectory: rest.downloadDirectory || '',
    remotePath: rest.remotePath || '',
    localPath: rest.localPath || '',
    remoteTempPath: rest.remoteTempPath || '',
    localTempPath: rest.localTempPath || '',
  }
}

/** "https://sabnzbd:8080" */
export function clientAddress(client: Pick<DownloadClient, 'useSsl' | 'host' | 'port'>): string {
  return `${client.useSsl ? 'https' : 'http'}://${client.host}:${client.port}`
}

export type ClientDraftErrors = Partial<
  Record<'name' | 'host' | 'port' | 'apiKey' | 'username', string>
>

export function validateClient(draft: ClientDraft): ClientDraftErrors {
  const errors: ClientDraftErrors = {}
  const info = clientTypeInfo(draft.type)
  if (!draft.name.trim()) errors.name = 'Give it a name to tell it apart in the queue.'
  if (!draft.host.trim()) errors.host = 'The host is required.'
  if (!Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535) {
    errors.port = 'A port from 1 to 65535.'
  }
  if (info.credentials === 'apiKey' && !draft.apiKey.trim()) {
    errors.apiKey = `${info.label} needs its API key: Config → General.`
  }
  if (info.usernameRequired && !draft.username.trim()) {
    errors.username = `${info.label} needs the control username it was set up with.`
  }
  return errors
}

/** What a Test run from this page said, which outranks the cached check until the next one. */
export interface LiveCheck {
  success: boolean
  message: string | null
  at: number
}

export type ClientState =
  | { kind: 'off' }
  | { kind: 'unknown' }
  | { kind: 'reachable'; latencyMs: number | null }
  | { kind: 'unreachable'; message: string }
  | { kind: 'mapping' }

/**
 * The row's status. A switched-off client has none: the dimmed row and its
 * switch say it. Otherwise the freshest reachability wins — a Test run here, or
 * the health monitor's cache — and a reachable client whose completed folder
 * was detected but never mapped needs a path mapping before imports work.
 */
export function clientState(
  client: Pick<DownloadClient, 'enabled' | 'remotePath' | 'localPath'>,
  health: Pick<ClientHealth, 'status' | 'message' | 'latencyMs' | 'since'> | undefined,
  live?: LiveCheck
): ClientState {
  if (!client.enabled) return { kind: 'off' }

  const needsMapping = Boolean(client.remotePath?.trim()) && !client.localPath?.trim()

  if (live) {
    if (!live.success) return { kind: 'unreachable', message: live.message ?? 'Connection failed' }
    return needsMapping ? { kind: 'mapping' } : { kind: 'reachable', latencyMs: null }
  }
  if (health?.status === 'error') return { kind: 'unreachable', message: health.message }
  if (needsMapping) return { kind: 'mapping' }
  if (health?.status === 'ok') return { kind: 'reachable', latencyMs: health.latencyMs }
  return { kind: 'unknown' }
}

/** Errors first, then clients needing attention, then the rest in their saved order. */
export function stateRank(state: ClientState): number {
  if (state.kind === 'unreachable') return 0
  if (state.kind === 'mapping') return 1
  return 2
}
