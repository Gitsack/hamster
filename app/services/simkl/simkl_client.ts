import PQueue from 'p-queue'
import AppSetting from '#models/app_setting'
import app from '@adonisjs/core/services/app'

const API = 'https://api.simkl.com'
const APP_NAME = 'hamster'
const appVersion = () => app.version?.toString() ?? '0.0.0'

/** Simkl allows 10 GETs a second; stay well under it. */
const queue = new PQueue({ interval: 250, intervalCap: 1 })

export class SimklApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export async function simklClientId(): Promise<string> {
  return ((await AppSetting.get<string>('simklClientId', '')) || '').trim()
}

/**
 * Every Simkl request carries client_id, app-name and app-version in the URL
 * and a descriptive User-Agent — requests without them are rejected.
 */
export async function simklUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, API)
  const clientId = await simklClientId()
  if (clientId) url.searchParams.set('client_id', clientId)
  url.searchParams.set('app-name', APP_NAME)
  url.searchParams.set('app-version', appVersion())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url
}

export async function simklGet<T>(
  path: string,
  params: Record<string, string> = {},
  accessToken?: string
): Promise<T> {
  const url = await simklUrl(path, params)
  return queue.add(async () => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': `${APP_NAME}/${appVersion()}`,
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new SimklApiError(res.status, `Simkl API error: ${res.status} ${path}`)
    return (await res.json()) as T
  }) as Promise<T>
}

/** OAuth endpoints take form-encoded bodies. */
export async function simklOAuthPost(path: string, body: Record<string, string>) {
  const url = await simklUrl(path)
  return fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': `${APP_NAME}/${appVersion()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20_000),
  })
}

/**
 * Simkl's Most Watched lists, published as static JSON on its CDN. No account
 * needed; the client ID is sent when one is set, as Simkl asks.
 */
export async function simklTrending(
  kind: 'movies' | 'tv',
  window: 'today' | 'week' | 'month'
): Promise<{ tmdbId: number; title: string }[]> {
  const url = new URL(`https://data.simkl.in/discover/trending/${kind}/${window}_100.json`)
  const clientId = await simklClientId()
  if (clientId) url.searchParams.set('client_id', clientId)
  url.searchParams.set('app-name', APP_NAME)
  url.searchParams.set('app-version', appVersion())
  const res = await fetch(url, {
    headers: { 'User-Agent': `${APP_NAME}/${appVersion()}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok)
    throw new SimklApiError(res.status, `Simkl trending ${kind}/${window}: ${res.status}`)
  const rows = (await res.json()) as { title?: string; ids?: { tmdb?: string } }[]
  return rows
    .map((r) => ({ tmdbId: Number(r.ids?.tmdb), title: r.title ?? '' }))
    .filter((r) => Number.isFinite(r.tmdbId) && r.tmdbId > 0)
}
