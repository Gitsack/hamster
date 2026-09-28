/**
 * Webhook URLs and headers routinely carry credentials: Plex's X-Plex-Token and
 * Jellyfin's api_key ride in the query string, a Discord or Slack hook keeps its
 * secret in the path, and an Authorization header is a password in all but name.
 *
 * The API never returns those parts. They are replaced with MASK, and on update
 * a value still holding MASK is restored piece by piece from what is stored —
 * so an operator can change the host of a masked URL without retyping the key.
 */

export const MASK = '****'

/** Query parameter names whose value is a credential. */
const SECRET_PARAM = /(key|token|secret|pass|pwd|auth|sig|signature|credential|session)/i

/** Header names whose value is a credential. */
const SECRET_HEADER = /(authorization|token|key|secret|cookie|pass|auth|session)/i

/** A long opaque path segment or query value: a token, not a word. */
function looksLikeToken(value: string, minLength: number): boolean {
  return value.length >= minLength && /[A-Za-z]/.test(value) && /\d/.test(value)
}

interface UrlParts {
  /** "https://" including any user name, up to and excluding the password. */
  scheme: string
  username: string
  password: string | null
  host: string
  segments: string[]
  /** Raw "k=v" pairs, in order, without the leading "?". */
  query: { key: string; value: string | null }[] | null
  hash: string
}

/**
 * Split a URL without re-encoding any of it. `new URL()` would normalise the
 * query (spaces to "+", reordered escapes), which would make the stored URL
 * differ from what was typed, so the raw pieces are cut out by hand.
 */
function splitUrl(raw: string): UrlParts | null {
  try {
    new URL(raw)
  } catch {
    return null
  }
  const match = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(raw)
  if (!match) return null
  const [, scheme, authority, path, search, hash] = match

  let username = ''
  let password: string | null = null
  let host = authority
  const at = authority.lastIndexOf('@')
  if (at !== -1) {
    const userinfo = authority.slice(0, at)
    host = authority.slice(at + 1)
    const colon = userinfo.indexOf(':')
    if (colon === -1) {
      username = userinfo
    } else {
      username = userinfo.slice(0, colon)
      password = userinfo.slice(colon + 1)
    }
  }
  const query = search
    ? search
        .slice(1)
        .split('&')
        .filter((pair) => pair !== '')
        .map((pair) => {
          const eq = pair.indexOf('=')
          return eq === -1
            ? { key: pair, value: null }
            : { key: pair.slice(0, eq), value: pair.slice(eq + 1) }
        })
    : null

  return {
    scheme,
    username,
    password,
    host,
    segments: path.split('/'),
    query,
    hash: hash ?? '',
  }
}

function joinUrl(parts: UrlParts): string {
  const userinfo =
    parts.username || parts.password !== null
      ? `${parts.username}${parts.password !== null ? `:${parts.password}` : ''}@`
      : ''
  const query =
    parts.query !== null
      ? `?${parts.query.map((p) => (p.value === null ? p.key : `${p.key}=${p.value}`)).join('&')}`
      : ''
  return `${parts.scheme}${userinfo}${parts.host}${parts.segments.join('/')}${query}${parts.hash}`
}

function decodeKey(key: string): string {
  try {
    return decodeURIComponent(key.replace(/\+/g, ' '))
  } catch {
    return key
  }
}

/**
 * The URL with every credential-looking part replaced by MASK. A URL that cannot
 * be taken apart is masked whole rather than risk leaking part of it.
 */
export function maskWebhookUrl(raw: string): string {
  const parts = splitUrl(raw)
  if (!parts) return MASK

  if (parts.password) parts.password = MASK
  parts.segments = parts.segments.map((segment) => (looksLikeToken(segment, 20) ? MASK : segment))
  if (parts.query) {
    parts.query = parts.query.map(({ key, value }) => {
      if (value === null || value === '') return { key, value }
      const secret = SECRET_PARAM.test(decodeKey(key)) || looksLikeToken(value, 20)
      return { key, value: secret ? MASK : value }
    })
  }
  return joinUrl(parts)
}

/**
 * Put the stored secrets back into a URL that came from the API.
 *
 * Unchanged, the stored URL wins outright. Edited (a new host, an extra
 * parameter) each MASK is filled from the same place in the stored URL — the
 * password from the password, a query value from the parameter of the same name,
 * a path segment from the same position. Returns null when a MASK has no stored
 * counterpart, so the caller can refuse rather than save a literal "****".
 */
export function restoreWebhookUrl(incoming: string, stored: string | null): string | null {
  if (!incoming.includes(MASK)) return incoming
  if (!stored) return null
  if (incoming === maskWebhookUrl(stored)) return stored

  const next = splitUrl(incoming)
  const prev = splitUrl(stored)
  if (!next || !prev) return null

  if (next.username.includes(MASK) || next.host.includes(MASK) || next.hash.includes(MASK)) {
    return null
  }

  if (next.password === MASK) {
    if (prev.password === null) return null
    next.password = prev.password
  } else if (next.password?.includes(MASK)) {
    return null
  }

  for (let i = 0; i < next.segments.length; i++) {
    const segment = next.segments[i]
    if (!segment.includes(MASK)) continue
    if (segment !== MASK || next.segments.length !== prev.segments.length) return null
    next.segments[i] = prev.segments[i]
  }

  if (next.query) {
    const seen = new Map<string, number>()
    for (const pair of next.query) {
      const name = decodeKey(pair.key)
      const occurrence = seen.get(name) ?? 0
      seen.set(name, occurrence + 1)
      if (pair.key.includes(MASK)) return null
      if (pair.value === null || !pair.value.includes(MASK)) continue
      if (pair.value !== MASK) return null
      const source = prev.query?.filter((p) => decodeKey(p.key) === name)[occurrence]
      if (!source || source.value === null) return null
      pair.value = source.value
    }
  }

  const restored = joinUrl(next)
  return restored.includes(MASK) ? null : restored
}

/** Headers with credential values replaced by MASK. */
export function maskWebhookHeaders(
  headers: Record<string, string> | null
): Record<string, string> | null {
  if (!headers) return headers
  const masked: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    masked[name] = SECRET_HEADER.test(name) && value ? MASK : value
  }
  return masked
}

/**
 * Put stored header values back where the API sent MASK. A MASK for a header
 * that was never stored returns null.
 */
export function restoreWebhookHeaders(
  incoming: Record<string, string>,
  stored: Record<string, string> | null
): Record<string, string> | null {
  const restored: Record<string, string> = {}
  for (const [name, value] of Object.entries(incoming)) {
    if (value !== MASK) {
      restored[name] = value
      continue
    }
    const match = Object.entries(stored ?? {}).find(
      ([storedName]) => storedName.toLowerCase() === name.toLowerCase()
    )
    if (!match) return null
    restored[name] = match[1]
  }
  return restored
}
