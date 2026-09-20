import env from '#start/env'

let hostMap: Map<string, string> | null = null
let pathMap: Array<{ from: string; to: string }> | null = null

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

function getPathMap(): Array<{ from: string; to: string }> {
  if (pathMap !== null) return pathMap

  pathMap = []
  const raw = env.get('SERVICE_PATH_MAP', '')
  if (!raw) return pathMap

  for (const entry of raw.split(',')) {
    const [from, to] = entry.split(':').map((s) => s.trim())
    if (from && to) {
      pathMap.push({ from, to })
    }
  }

  return pathMap
}

export interface PathMapRule {
  from: string
  to: string
}

/**
 * Replace the longest matching prefix in `p`, on a path-segment boundary.
 *
 * Split out from {@link mapPath} because the rules there come from the
 * environment and are cached for the life of the process — which leaves the
 * substitution itself untestable, and makes any test of it pass or fail
 * depending on whether the machine running it happens to have SERVICE_PATH_MAP
 * set. This function takes its rules as an argument, so the behaviour can be
 * pinned down exactly.
 */
export function applyPathMap(p: string | null | undefined, rules: PathMapRule[]): string {
  if (!p) return p ?? ''

  // Longest, most-specific prefix wins: without this "/d" would shadow
  // "/downloads" if both were configured.
  const ordered = [...rules].sort((a, b) => b.from.length - a.from.length)

  for (const { from, to } of ordered) {
    if (p === from) return to
    // Only on a full segment boundary, so "/downloadsX" is never rewritten.
    if (p.startsWith(from + '/')) {
      return to + p.slice(from.length)
    }
  }
  return p
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

/**
 * Translate a filesystem path through SERVICE_PATH_MAP.
 *
 * Used at FS-access boundaries when the DB stores a path that's valid in one
 * runtime (typically Docker, e.g. "/downloads/complete") but mounted at a
 * different location in another runtime (typically local dev, e.g.
 * "/mnt/nas/download/complete").
 *
 * Only the longest matching FROM prefix is replaced, and only on a full path
 * segment boundary ("/" or end-of-string) to avoid translating "/downloadsX".
 */
export function mapPath(p: string | null | undefined): string {
  return applyPathMap(p, getPathMap())
}
