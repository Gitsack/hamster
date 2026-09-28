import { DEFAULT_EVENTS } from './event_catalog'
import {
  WEBHOOK_PRESETS,
  basicAuth,
  deliveryProblem,
  detectPreset,
  mergeDeliveries,
  providerDelivery,
  providerToTarget,
  sortTargets,
  targetFailing,
  targetUpdateBody,
  webhookDelivery,
  webhookToTarget,
  type ProviderRecord,
  type WebhookRecord,
} from './targets'

function provider(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'p1',
    name: 'Phone',
    type: 'ntfy',
    enabled: true,
    settings: { topic: 'hamster', password: 'ab****yz' },
    ...DEFAULT_EVENTS,
    includeMusic: true,
    includeMovies: true,
    includeTv: false,
    includeBooks: true,
    lastDelivery: null,
    ...overrides,
  }
}

function webhook(overrides: Partial<WebhookRecord> = {}): WebhookRecord {
  return {
    id: 'w1',
    name: 'Jellyfin library refresh',
    url: 'http://jf:8096/Library/Refresh?api_key=****',
    enabled: true,
    method: 'POST',
    headers: null,
    payloadTemplate: null,
    ...DEFAULT_EVENTS,
    lastDelivery: null,
    ...overrides,
  }
}

describe('targets', () => {
  it('normalises both backends into one shape', () => {
    const p = providerToTarget(provider(), [{ type: 'ntfy', name: 'Ntfy', fields: [] }])
    expect(p).toMatchObject({ key: 'provider:p1', kind: 'provider', typeLabel: 'Ntfy' })
    expect(p.media?.includeTv).toBe(false)

    const w = webhookToTarget(webhook())
    expect(w).toMatchObject({ key: 'webhook:w1', kind: 'webhook', typeLabel: 'Jellyfin refresh' })
    expect(w.media).toBeNull()
  })

  it('recognises presets from the URL shape', () => {
    expect(detectPreset('http://plex:32400/library/sections/all/refresh?X-Plex-Token=****')).toBe(
      'plex'
    )
    expect(detectPreset('http://kodi:8080/jsonrpc')).toBe('kodi')
    expect(detectPreset('http://emby:8096/Library/Refresh?api_key=x', 'Emby refresh')).toBe('emby')
    expect(detectPreset('https://example.com/hook')).toBeNull()
    expect(detectPreset('not a url')).toBeNull()
  })

  it('sorts failing, enabled targets first, then by name', () => {
    const failed = {
      success: false,
      status: 401,
      error: 'HTTP 401',
      createdAt: '2026-09-27T10:00:00Z',
    }
    const list = sortTargets([
      webhookToTarget(webhook({ id: 'a', name: 'Alpha' })),
      providerToTarget(provider({ id: 'z', name: 'Zulu', lastDelivery: failed })),
      providerToTarget(provider({ id: 'off', name: 'Beta', enabled: false, lastDelivery: failed })),
    ])
    expect(list.map((t) => t.name)).toEqual(['Zulu', 'Alpha', 'Beta'])
    expect(targetFailing(list[2])).toBe(false)
  })

  it('describes a failed delivery by its status first', () => {
    expect(deliveryProblem({ status: 401, error: 'HTTP 401' })).toBe('HTTP 401')
    expect(deliveryProblem({ status: 502, error: 'Bad gateway' })).toBe('HTTP 502 · Bad gateway')
    expect(deliveryProblem({ status: null, error: 'getaddrinfo ENOTFOUND sab' })).toBe(
      'getaddrinfo ENOTFOUND sab'
    )
  })

  it('builds a full PUT body for the Enabled switch without touching secrets', () => {
    const p = targetUpdateBody(providerToTarget(provider()), { enabled: false })
    expect(p).toMatchObject({ name: 'Phone', type: 'ntfy', enabled: false, includeTv: false })
    expect((p as { settings: Record<string, unknown> }).settings.password).toBe('ab****yz')

    const w = targetUpdateBody(webhookToTarget(webhook()), { enabled: false })
    expect(w).toMatchObject({ url: 'http://jf:8096/Library/Refresh?api_key=****', enabled: false })
    // Headers and template left out, so the server keeps them.
    expect(w).not.toHaveProperty('headers')
    expect(w).not.toHaveProperty('payloadTemplate')
  })

  it('merges both delivery logs newest first, failures floated up', () => {
    const merged = mergeDeliveries([
      [
        providerDelivery({
          id: '1',
          providerId: 'p1',
          eventType: 'import.completed',
          title: 'Imported',
          message: 'x',
          success: true,
          errorMessage: null,
          createdAt: '2026-09-27T10:00:00Z',
        }),
      ],
      [
        webhookDelivery({
          id: '2',
          webhookId: 'w1',
          eventType: 'health.restored',
          payload: { source: 'WebhookTest' },
          responseStatus: 500,
          responseBody: 'boom',
          success: false,
          errorMessage: 'HTTP 500',
          createdAt: '2026-09-27T09:00:00Z',
        }),
        webhookDelivery({
          id: '3',
          webhookId: 'w1',
          eventType: 'grab',
          payload: {},
          responseStatus: 200,
          responseBody: '',
          success: true,
          errorMessage: null,
          createdAt: '2026-09-27T11:00:00Z',
        }),
      ],
    ])
    expect(merged.map((d) => d.key)).toEqual(['webhook:2', 'webhook:3', 'provider:1'])
    expect(merged[0].eventLabel).toBe('Test')
    expect(merged[0].response).toBe('boom')
    expect(mergeDeliveries([merged], 1)).toHaveLength(1)
  })

  it('builds preset URLs, encoding what the operator typed', () => {
    expect(
      WEBHOOK_PRESETS.plex.buildUrl({
        serverUrl: 'http://plex:32400/',
        token: 'a b',
        sectionId: '',
      })
    ).toBe('http://plex:32400/library/sections/all/refresh?X-Plex-Token=a%20b')
    expect(WEBHOOK_PRESETS.kodi.buildUrl({ serverUrl: 'http://kodi:8080' })).toBe(
      'http://kodi:8080/jsonrpc'
    )
    expect(WEBHOOK_PRESETS.kodi.headers?.({ username: 'kodi', password: 'pw' })).toEqual({
      Authorization: 'Basic a29kaTpwdw==',
    })
    expect(WEBHOOK_PRESETS.kodi.headers?.({})).toEqual({})
    expect(WEBHOOK_PRESETS.kodi.payloadTemplate).toContain('VideoLibrary.Scan')
    expect(basicAuth('ü', 'x')).toBe(`Basic ${btoa('Ã¼:x')}`)
  })
})
