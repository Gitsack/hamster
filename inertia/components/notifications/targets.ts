/**
 * One list over two backends. Push services live at /api/v1/notifications,
 * HTTP endpoints at /api/v1/webhooks; both are normalised into `Target` here,
 * and every write is routed back by `kind`. Pure apart from the fetch helpers
 * at the bottom, so the mapping is tested directly (targets.test.ts).
 */

import { describeHttpError } from '@/components/settings/row-group'
import {
  ALL_MEDIA,
  DEFAULT_EVENTS,
  REFRESH_EVENTS,
  eventTypeLabel,
  pickEvents,
  pickMedia,
  type EventFlags,
  type MediaFlags,
} from './event_catalog'

// ---------------------------------------------------------------------------
// API records
// ---------------------------------------------------------------------------

export interface LastDelivery {
  success: boolean
  /** HTTP status, webhooks only. */
  status: number | null
  error: string | null
  createdAt: string
}

export interface ProviderRecord extends EventFlags, MediaFlags {
  id: string
  name: string
  type: string
  enabled: boolean
  settings: Record<string, unknown>
  lastDelivery?: LastDelivery | null
}

export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH'

export interface WebhookRecord extends EventFlags {
  id: string
  name: string
  /** Credentials masked as ****; sending it back unchanged keeps them. */
  url: string
  enabled: boolean
  method: WebhookMethod
  headers: Record<string, string> | null
  payloadTemplate: string | null
  lastDelivery?: LastDelivery | null
}

export interface ProviderField {
  name: string
  label: string
  type: string
  required: boolean
  placeholder?: string
}

export interface ProviderType {
  type: string
  name: string
  fields: ProviderField[]
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export type TargetKind = 'provider' | 'webhook'

export interface Target {
  /** Unique across both backends: "provider:<id>", "webhook:<id>". */
  key: string
  kind: TargetKind
  id: string
  name: string
  /** "Discord", "Webhook", "Plex refresh". */
  typeLabel: string
  enabled: boolean
  events: EventFlags
  /** Webhooks fire for every media type; null says so. */
  media: MediaFlags | null
  lastDelivery: LastDelivery | null
  provider?: ProviderRecord
  webhook?: WebhookRecord
}

export function targetKey(kind: TargetKind, id: string): string {
  return `${kind}:${id}`
}

const PROVIDER_LABELS: Record<string, string> = {
  discord: 'Discord',
  telegram: 'Telegram',
  pushover: 'Pushover',
  slack: 'Slack',
  gotify: 'Gotify',
  email: 'Email',
  ntfy: 'Ntfy',
}

export function providerLabel(type: string, types?: readonly ProviderType[]): string {
  return types?.find((t) => t.type === type)?.name ?? PROVIDER_LABELS[type] ?? type
}

export function providerToTarget(record: ProviderRecord, types?: readonly ProviderType[]): Target {
  return {
    key: targetKey('provider', record.id),
    kind: 'provider',
    id: record.id,
    name: record.name,
    typeLabel: providerLabel(record.type, types),
    enabled: record.enabled,
    events: pickEvents(record),
    media: pickMedia(record),
    lastDelivery: record.lastDelivery ?? null,
    provider: record,
  }
}

export function webhookToTarget(record: WebhookRecord): Target {
  const preset = detectPreset(record.url, record.name)
  return {
    key: targetKey('webhook', record.id),
    kind: 'webhook',
    id: record.id,
    name: record.name,
    typeLabel: preset ? WEBHOOK_PRESETS[preset].typeLabel : 'Webhook',
    enabled: record.enabled,
    events: pickEvents(record),
    media: null,
    lastDelivery: record.lastDelivery ?? null,
    webhook: record,
  }
}

/** A failed last delivery on an enabled target is the thing to fix. */
export function targetFailing(target: Target): boolean {
  return target.enabled && target.lastDelivery !== null && !target.lastDelivery.success
}

/** Failing targets first, then by name. */
export function sortTargets(targets: readonly Target[]): Target[] {
  return [...targets].sort(
    (a, b) =>
      Number(targetFailing(b)) - Number(targetFailing(a)) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}

/** "HTTP 401" or the error text; for the destructive line under a failing row. */
export function deliveryProblem(delivery: Pick<LastDelivery, 'status' | 'error'>): string {
  if (delivery.status !== null && delivery.status >= 400) {
    const error =
      delivery.error && delivery.error !== `HTTP ${delivery.status}` ? delivery.error : ''
    return error ? `HTTP ${delivery.status} · ${error}` : `HTTP ${delivery.status}`
  }
  return delivery.error || 'Delivery failed'
}

/** The host a webhook calls, for the row's meta line. */
export function webhookHost(url: string): string | null {
  try {
    return new URL(url).host || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Webhook presets
// ---------------------------------------------------------------------------

export type WebhookPresetId = 'custom' | 'kodi' | 'plex' | 'jellyfin' | 'emby'

export interface PresetField {
  name: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder: string
  help?: string
  required: boolean
}

export interface WebhookPreset {
  id: WebhookPresetId
  name: string
  /** The row's type label once created. */
  typeLabel: string
  description: string
  group: 'http' | 'refresh'
  defaultName: string
  method: WebhookMethod
  events: Readonly<EventFlags>
  fields: PresetField[]
  buildUrl: (values: Record<string, string>) => string
  headers?: (values: Record<string, string>) => Record<string, string>
  payloadTemplate?: string
}

function trimSlash(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}

/** UTF-8 safe base64, for a Basic Authorization header. */
export function basicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}

/**
 * Kodi's JSON-RPC wants a method call, not Hamster's event body. VideoLibrary.Scan
 * rescans every video source; Kodi skips unchanged folders, so it is cheap.
 */
export const KODI_PAYLOAD_TEMPLATE = '{"jsonrpc":"2.0","method":"VideoLibrary.Scan","id":"hamster"}'

export const WEBHOOK_PRESETS: Record<WebhookPresetId, WebhookPreset> = {
  custom: {
    id: 'custom',
    name: 'Custom webhook',
    typeLabel: 'Webhook',
    description: 'Any URL. Gets a JSON body describing the event.',
    group: 'http',
    defaultName: '',
    method: 'POST',
    events: DEFAULT_EVENTS,
    fields: [
      {
        name: 'url',
        label: 'URL',
        type: 'url',
        placeholder: 'https://example.com/hooks/hamster',
        help: 'Must be reachable from the Hamster server, not from your browser.',
        required: true,
      },
    ],
    buildUrl: (values) => (values.url ?? '').trim(),
  },
  kodi: {
    id: 'kodi',
    name: 'Kodi',
    typeLabel: 'Kodi',
    description: 'Rescans the video library over JSON-RPC.',
    group: 'http',
    defaultName: 'Kodi library update',
    method: 'POST',
    events: REFRESH_EVENTS,
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://kodi.lan:8080',
        help: 'Turn on "Allow remote control via HTTP" in Kodi.',
        required: true,
      },
      { name: 'username', label: 'Username', type: 'text', placeholder: 'kodi', required: false },
      { name: 'password', label: 'Password', type: 'password', placeholder: '', required: false },
    ],
    buildUrl: (values) => `${trimSlash(values.serverUrl)}/jsonrpc`,
    headers: (values): Record<string, string> =>
      values.username ? { Authorization: basicAuth(values.username, values.password ?? '') } : {},
    payloadTemplate: KODI_PAYLOAD_TEMPLATE,
  },
  plex: {
    id: 'plex',
    name: 'Plex',
    typeLabel: 'Plex refresh',
    description: 'Rescans a library section after an import.',
    group: 'refresh',
    defaultName: 'Plex library refresh',
    method: 'GET',
    events: REFRESH_EVENTS,
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://plex.lan:32400',
        required: true,
      },
      {
        name: 'token',
        label: 'Plex token',
        type: 'password',
        placeholder: 'X-Plex-Token',
        help: 'Shown in the URL of "View XML" on any item: …?X-Plex-Token=…',
        required: true,
      },
      {
        name: 'sectionId',
        label: 'Library section ID',
        type: 'text',
        placeholder: 'all',
        help: 'Leave empty to rescan every section.',
        required: false,
      },
    ],
    buildUrl: (values) =>
      `${trimSlash(values.serverUrl)}/library/sections/${encodeURIComponent(
        (values.sectionId ?? '').trim() || 'all'
      )}/refresh?X-Plex-Token=${encodeURIComponent((values.token ?? '').trim())}`,
  },
  jellyfin: {
    id: 'jellyfin',
    name: 'Jellyfin',
    typeLabel: 'Jellyfin refresh',
    description: 'Rescans all libraries after an import.',
    group: 'refresh',
    defaultName: 'Jellyfin library refresh',
    method: 'POST',
    events: REFRESH_EVENTS,
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://jellyfin.lan:8096',
        required: true,
      },
      {
        name: 'apiKey',
        label: 'API key',
        type: 'password',
        placeholder: '',
        help: 'Dashboard → API Keys → +',
        required: true,
      },
    ],
    buildUrl: (values) =>
      `${trimSlash(values.serverUrl)}/Library/Refresh?api_key=${encodeURIComponent(
        (values.apiKey ?? '').trim()
      )}`,
  },
  emby: {
    id: 'emby',
    name: 'Emby',
    typeLabel: 'Emby refresh',
    description: 'Rescans all libraries after an import.',
    group: 'refresh',
    defaultName: 'Emby library refresh',
    method: 'POST',
    events: REFRESH_EVENTS,
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://emby.lan:8096',
        required: true,
      },
      {
        name: 'apiKey',
        label: 'API key',
        type: 'password',
        placeholder: '',
        help: 'Dashboard → Advanced → API Keys',
        required: true,
      },
    ],
    buildUrl: (values) =>
      `${trimSlash(values.serverUrl)}/Library/Refresh?api_key=${encodeURIComponent(
        (values.apiKey ?? '').trim()
      )}`,
  },
}

/**
 * Recognise what a stored webhook was made from, by the shape of its URL.
 * Jellyfin and Emby share one endpoint; the name usually tells them apart.
 */
export function detectPreset(url: string, name = ''): WebhookPresetId | null {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }
  if (/\/library\/sections\/[^/]+\/refresh\/?$/i.test(path)) return 'plex'
  if (/\/jsonrpc\/?$/i.test(path)) return 'kodi'
  if (/\/Library\/Refresh\/?$/.test(path)) return /emby/i.test(name) ? 'emby' : 'jellyfin'
  return null
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export interface ProviderDeliveryRecord {
  id: string
  providerId: string
  eventType: string
  title: string
  message: string | null
  success: boolean
  errorMessage: string | null
  createdAt: string
}

export interface WebhookDeliveryRecord {
  id: string
  webhookId: string
  eventType: string
  payload: Record<string, unknown> | null
  responseStatus: number | null
  responseBody: string | null
  success: boolean
  errorMessage: string | null
  createdAt: string
}

export interface Delivery {
  key: string
  kind: TargetKind
  targetKey: string
  eventType: string
  /** "Imported", or "Test" for a test send. */
  eventLabel: string
  success: boolean
  status: number | null
  error: string | null
  createdAt: string
  /** What was sent: the message (push) or the request body (webhook). */
  sent: string | null
  /** What came back (webhooks only). */
  response: string | null
}

export function providerDelivery(record: ProviderDeliveryRecord): Delivery {
  const isTest = record.title === 'Test Notification'
  return {
    key: `provider:${record.id}`,
    kind: 'provider',
    targetKey: targetKey('provider', record.providerId),
    eventType: record.eventType,
    eventLabel: isTest ? 'Test' : eventTypeLabel(record.eventType),
    success: record.success,
    status: null,
    error: record.errorMessage,
    createdAt: record.createdAt,
    sent: [record.title, record.message].filter(Boolean).join('\n\n') || null,
    response: null,
  }
}

export function webhookDelivery(record: WebhookDeliveryRecord): Delivery {
  const isTest = record.payload?.source === 'WebhookTest'
  return {
    key: `webhook:${record.id}`,
    kind: 'webhook',
    targetKey: targetKey('webhook', record.webhookId),
    eventType: record.eventType,
    eventLabel: isTest ? 'Test' : eventTypeLabel(record.eventType),
    success: record.success,
    status: record.responseStatus,
    error: record.errorMessage,
    createdAt: record.createdAt,
    sent: record.payload ? JSON.stringify(record.payload, null, 2) : null,
    response: record.responseBody,
  }
}

/** Newest first, capped, then failures floated to the top (each half stays chronological). */
export function mergeDeliveries(lists: readonly (readonly Delivery[])[], limit = 50): Delivery[] {
  const newest = lists
    .flat()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)
  return [...newest.filter((d) => !d.success), ...newest.filter((d) => d.success)]
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** A failed request, with the server's own words when it gave any. */
export class RequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'RequestError'
    this.status = status
  }
}

async function readError(response: Response): Promise<RequestError> {
  let message = ''
  try {
    const body = (await response.json()) as {
      error?: unknown
      message?: unknown
      errors?: { message?: unknown }[]
    }
    if (typeof body.error === 'string') message = body.error
    else if (Array.isArray(body.errors) && typeof body.errors[0]?.message === 'string') {
      message = body.errors[0].message
    } else if (typeof body.message === 'string') message = body.message
  } catch {
    // Not JSON: the status line is all there is.
  }
  return new RequestError(message || describeHttpError(response), response.status)
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) throw await readError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** The base path of a target's own backend. */
export function targetPath(kind: TargetKind, id?: string): string {
  const base = kind === 'provider' ? '/api/v1/notifications' : '/api/v1/webhooks'
  return id ? `${base}/${id}` : base
}

/** The full PUT body for a target, with some fields changed (the row's Enabled switch). */
export function targetUpdateBody(target: Target, changes: Partial<{ enabled: boolean }>) {
  if (target.kind === 'provider' && target.provider) {
    const p = target.provider
    return {
      name: p.name,
      type: p.type,
      enabled: p.enabled,
      // Masked secrets go back as-is; the server keeps what it stored.
      settings: p.settings,
      ...target.events,
      ...(target.media ?? ALL_MEDIA),
      ...changes,
    }
  }
  const w = target.webhook!
  // Headers and template are left out, so the server keeps them untouched.
  return {
    name: w.name,
    url: w.url,
    method: w.method,
    enabled: w.enabled,
    ...target.events,
    ...changes,
  }
}

export interface TestResult {
  success: boolean
  statusCode?: number
  error?: string
}

export async function fetchTargetDeliveries(target: Target, limit = 50): Promise<Delivery[]> {
  if (target.kind === 'provider') {
    const rows = await requestJson<ProviderDeliveryRecord[]>(
      `/api/v1/notifications/history?providerId=${encodeURIComponent(target.id)}&limit=${limit}`
    )
    return rows.map(providerDelivery)
  }
  const rows = await requestJson<WebhookDeliveryRecord[]>(
    `/api/v1/webhooks/${encodeURIComponent(target.id)}/history?limit=${limit}`
  )
  return rows.map(webhookDelivery)
}

export async function fetchAllDeliveries(limit = 50): Promise<Delivery[]> {
  const [providers, webhooks] = await Promise.all([
    requestJson<ProviderDeliveryRecord[]>(`/api/v1/notifications/history?limit=${limit}`),
    requestJson<WebhookDeliveryRecord[]>(`/api/v1/webhooks/history?limit=${limit}`),
  ])
  return mergeDeliveries([providers.map(providerDelivery), webhooks.map(webhookDelivery)], limit)
}

export async function clearTargetDeliveries(target: Target): Promise<void> {
  if (target.kind === 'provider') {
    await requestJson(`/api/v1/notifications/history?providerId=${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
    })
  } else {
    await requestJson(`/api/v1/webhooks/${encodeURIComponent(target.id)}/history`, {
      method: 'DELETE',
    })
  }
}

export async function clearAllDeliveries(): Promise<void> {
  await Promise.all([
    requestJson('/api/v1/notifications/history', { method: 'DELETE' }),
    requestJson('/api/v1/webhooks/history', { method: 'DELETE' }),
  ])
}
