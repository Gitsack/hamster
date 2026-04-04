import env from '#start/env'

let hostMap: Map<string, string> | null = null

function getHostMap(): Map<string, string> {
  if (hostMap !== null) return hostMap

  hostMap = new Map()
  const raw = env.get('SERVICE_HOST_MAP', '')
  if (!raw) return hostMap

  for (const entry of raw.split(',')) {
    const [from, to] = entry.split(':').map((s) => s.trim())
    if (from && to) {
      hostMap.set(from, to)
    }
  }
  return hostMap
}

/**
 * Map a hostname using SERVICE_HOST_MAP env var.
 * Used for local development where Docker hostnames (e.g. "gluetun")
 * need to be translated to "localhost".
 */
export function mapHost(host: string): string {
  return getHostMap().get(host) ?? host
}

/**
 * Map the hostname within a full URL using SERVICE_HOST_MAP.
 */
export function mapUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const mapped = getHostMap().get(parsed.hostname)
    if (mapped) {
      parsed.hostname = mapped
      return parsed.toString().replace(/\/$/, '')
    }
    return url
  } catch {
    return url
  }
}
