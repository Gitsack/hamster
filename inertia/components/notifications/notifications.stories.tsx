import type { Meta, StoryObj } from '@storybook/react'
import { useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { NotificationsSettings } from './notifications-settings'
import { TargetSheet, type TargetSheetMode } from './target-sheet'
import { webhookToTarget, type ProviderType, type WebhookRecord } from './targets'
import { DEFAULT_EVENTS, REFRESH_EVENTS } from './event_catalog'

/**
 * Settings → Notifications against a canned API: push services and webhooks in
 * one list, a failing endpoint floated to the top, and the delivery log.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const PROVIDER_TYPES: ProviderType[] = [
  {
    type: 'discord',
    name: 'Discord',
    fields: [
      { name: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true },
      { name: 'username', label: 'Username', type: 'text', required: false },
    ],
  },
  {
    type: 'telegram',
    name: 'Telegram',
    fields: [
      { name: 'botToken', label: 'Bot Token', type: 'password', required: true },
      { name: 'chatId', label: 'Chat ID', type: 'text', required: true },
    ],
  },
  {
    type: 'email',
    name: 'Email',
    fields: [
      { name: 'host', label: 'SMTP Host', type: 'text', required: true },
      { name: 'port', label: 'SMTP Port', type: 'number', required: true },
      { name: 'secure', label: 'Use SSL/TLS', type: 'boolean', required: false },
      { name: 'username', label: 'Username', type: 'text', required: false },
      { name: 'password', label: 'Password', type: 'password', required: false },
      { name: 'from', label: 'From Address', type: 'email', required: true },
      { name: 'to', label: 'To Address', type: 'email', required: true },
    ],
  },
  {
    type: 'ntfy',
    name: 'Ntfy',
    fields: [
      { name: 'serverUrl', label: 'Server URL', type: 'url', required: false },
      { name: 'topic', label: 'Topic', type: 'text', required: true },
      { name: 'priority', label: 'Priority (1-5)', type: 'number', required: false },
    ],
  },
]

const media = { includeMusic: true, includeMovies: true, includeTv: true, includeBooks: true }

const PROVIDERS = [
  {
    id: 'p1',
    name: 'Discord #media',
    type: 'discord',
    enabled: true,
    settings: { webhookUrl: 'http****wxyz', username: 'Hamster' },
    ...DEFAULT_EVENTS,
    onDownloadComplete: true,
    ...media,
    lastDelivery: { success: true, status: null, error: null, createdAt: minutesAgo(42) },
  },
  {
    id: 'p2',
    name: 'Phone',
    type: 'ntfy',
    enabled: true,
    settings: { topic: 'hamster-alerts', priority: 4 },
    ...DEFAULT_EVENTS,
    onGrab: false,
    onImportComplete: false,
    onUpgrade: false,
    ...media,
    includeMusic: false,
    includeBooks: false,
    lastDelivery: null,
  },
  {
    id: 'p3',
    name: 'Weekly mail',
    type: 'email',
    enabled: false,
    settings: {
      host: 'smtp.fastmail.com',
      port: 465,
      secure: true,
      username: 'me@example.com',
      password: '****',
      from: 'hamster@example.com',
      to: 'me@example.com',
    },
    ...DEFAULT_EVENTS,
    ...media,
    lastDelivery: {
      success: false,
      status: null,
      error: 'Invalid login: 535 Authentication failed',
      createdAt: minutesAgo(60 * 24 * 3),
    },
  },
]

const JELLYFIN: WebhookRecord = {
  id: 'w1',
  name: 'Jellyfin library refresh',
  url: 'http://jellyfin.lan:8096/Library/Refresh?api_key=****',
  enabled: true,
  method: 'POST',
  headers: null,
  payloadTemplate: null,
  ...REFRESH_EVENTS,
  lastDelivery: { success: false, status: 401, error: 'HTTP 401', createdAt: minutesAgo(185) },
}

const WEBHOOKS: WebhookRecord[] = [
  JELLYFIN,
  {
    id: 'w2',
    name: 'Living room Kodi',
    url: 'http://kodi.lan:8080/jsonrpc',
    enabled: true,
    method: 'POST',
    headers: { Authorization: '****' },
    payloadTemplate: '{"jsonrpc":"2.0","method":"VideoLibrary.Scan","id":"hamster"}',
    ...REFRESH_EVENTS,
    lastDelivery: { success: true, status: 200, error: null, createdAt: minutesAgo(12) },
  },
  {
    id: 'w3',
    name: 'Home Assistant automation with a rather long name',
    url: 'https://homeassistant.example.com/api/webhook/****',
    enabled: true,
    method: 'POST',
    headers: null,
    payloadTemplate: null,
    ...DEFAULT_EVENTS,
    lastDelivery: { success: true, status: 200, error: null, createdAt: minutesAgo(60 * 26) },
  },
]

const PROVIDER_HISTORY = [
  {
    id: 'n1',
    providerId: 'p1',
    eventType: 'import.completed',
    title: 'Imported: Dune: Part Two (2024)',
    message: 'Bluray-2160p · 38.4 GB · moved to /media/movies',
    success: true,
    errorMessage: null,
    createdAt: minutesAgo(42),
  },
  {
    id: 'n2',
    providerId: 'p3',
    eventType: 'import.failed',
    title: 'Import failed: The Bear S03E04',
    message: 'No video file found in the download folder.',
    success: false,
    errorMessage: 'Invalid login: 535 Authentication failed',
    createdAt: minutesAgo(60 * 24 * 3),
  },
]

const WEBHOOK_HISTORY = [
  {
    id: 'h1',
    webhookId: 'w1',
    eventType: 'import.completed',
    payload: { eventType: 'import.completed', instanceName: 'Hamster' },
    responseStatus: 401,
    responseBody: '{"error":"Unauthorized","message":"The api_key is invalid or expired."}',
    success: false,
    errorMessage: 'HTTP 401',
    createdAt: minutesAgo(185),
  },
  {
    id: 'h2',
    webhookId: 'w2',
    eventType: 'upgrade',
    payload: { jsonrpc: '2.0', method: 'VideoLibrary.Scan' },
    responseStatus: 200,
    responseBody: '{"id":"hamster","jsonrpc":"2.0","result":"OK"}',
    success: true,
    errorMessage: null,
    createdAt: minutesAgo(12),
  },
  {
    id: 'h3',
    webhookId: 'w3',
    eventType: 'health.restored',
    payload: { source: 'WebhookTest' },
    responseStatus: 200,
    responseBody: '',
    success: true,
    errorMessage: null,
    createdAt: minutesAgo(60 * 26),
  },
]

const FIXTURES: Array<[RegExp, unknown]> = [
  [/\/api\/v1\/notifications\/types$/, PROVIDER_TYPES],
  [/\/api\/v1\/notifications\/history\?providerId=([^&]+)/, null],
  [/\/api\/v1\/notifications\/history/, PROVIDER_HISTORY],
  [/\/api\/v1\/notifications$/, PROVIDERS],
  [/\/api\/v1\/webhooks\/history/, WEBHOOK_HISTORY],
  [/\/api\/v1\/webhooks\/([^/]+)\/history/, null],
  [/\/api\/v1\/webhooks$/, WEBHOOKS],
]

function installFetchStub() {
  const w = window as typeof window & { __notificationsFetchStub?: boolean }
  if (w.__notificationsFetchStub) return
  w.__notificationsFetchStub = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    if (method !== 'GET' && url.startsWith('/api/v1/')) {
      // Writes succeed and echo, so the controls can be exercised.
      await new Promise((resolve) => setTimeout(resolve, 400))
      if (url.endsWith('/test')) {
        return Response.json({ success: false, statusCode: 401, error: 'HTTP 401' })
      }
      return method === 'DELETE'
        ? new Response(null, { status: 204 })
        : Response.json({ id: 'new', ...JSON.parse(String(init?.body ?? '{}')) })
    }
    for (const [pattern, body] of FIXTURES) {
      const match = pattern.exec(url)
      if (!match) continue
      await new Promise((resolve) => setTimeout(resolve, 250))
      // Per-target history: filter the shared fixtures by id.
      const data =
        body !== null
          ? body
          : url.includes('providerId=')
            ? PROVIDER_HISTORY.filter((h) => h.providerId === match[1])
            : WEBHOOK_HISTORY.filter((h) => h.webhookId === match[1])
      return Response.json(data)
    }
    return realFetch(input, init)
  }
}

function Frame({ children }: { children: ReactNode }) {
  installFetchStub()
  return (
    <div className="w-full px-4 py-6">
      {children}
      <Toaster />
    </div>
  )
}

const meta: Meta = {
  title: 'notifications/Notifications',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

export const Page: Story = {
  render: () => (
    <Frame>
      <NotificationsSettings />
    </Frame>
  ),
}
export const PageDark: Story = { ...Page, globals: { theme: 'dark' } }
export const PagePhone: Story = { ...Page, globals: { viewport: { value: 'phone' } } }
export const PagePhoneDark: Story = {
  ...Page,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}

function SheetStory({ mode }: { mode: TargetSheetMode }) {
  const [open, setOpen] = useState(true)
  return (
    <Frame>
      <button type="button" className="text-sm underline" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <TargetSheet
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        providerTypes={PROVIDER_TYPES}
        onChanged={() => {}}
      />
    </Frame>
  )
}

export const EditWebhook: Story = {
  render: () => <SheetStory mode={{ kind: 'edit', target: webhookToTarget(WEBHOOKS[1]) }} />,
}
export const EditWebhookPhoneDark: Story = {
  ...EditWebhook,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}

export const AddEmail: Story = {
  render: () => <SheetStory mode={{ kind: 'new', choice: { kind: 'provider', type: 'email' } }} />,
}
export const AddEmailPhone: Story = { ...AddEmail, globals: { viewport: { value: 'phone' } } }

export const AddPlex: Story = {
  render: () => <SheetStory mode={{ kind: 'new', choice: { kind: 'webhook', preset: 'plex' } }} />,
}
export const AddPlexDark: Story = { ...AddPlex, globals: { theme: 'dark' } }
