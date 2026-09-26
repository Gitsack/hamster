import net from 'node:net'

/**
 * Whether an IP address belongs to this network rather than the internet:
 * loopback, RFC 1918 private ranges, link-local, and their IPv6 equivalents
 * (including IPv4-mapped IPv6, which is how Node reports IPv4 peers on a
 * dual-stack socket). Anything unparseable is not local.
 */
export function isLocalAddress(address: string | null | undefined): boolean {
  if (!address) return false
  let ip = address.trim()
  // "[::1]:1234" / "1.2.3.4:5678" as some Forwarded headers write them
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/)
  if (bracketed) ip = bracketed[1]
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'))
  ip = ip.replace(/%.*$/, '') // zone index, e.g. fe80::1%eth0

  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) ip = mapped[1]

  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    )
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true
    const first = Number.parseInt(lower.split(':')[0] || '0', 16)
    // fc00::/7 unique local, fe80::/10 link-local
    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80
  }

  return false
}

/**
 * Every client address a request claims to have passed through, from the
 * forwarding headers reverse proxies add.
 */
export function forwardedAddresses(headers: {
  forwardedFor?: string | null
  realIp?: string | null
  forwarded?: string | null
}): string[] {
  const addresses: string[] = []
  if (headers.forwardedFor) {
    addresses.push(...headers.forwardedFor.split(',').map((part) => part.trim()))
  }
  if (headers.realIp) {
    addresses.push(headers.realIp.trim())
  }
  if (headers.forwarded) {
    for (const match of headers.forwarded.matchAll(/for=("?)([^";,]+)\1/gi)) {
      addresses.push(match[2])
    }
  }
  return addresses.filter((address) => address !== '')
}

/**
 * Whether a request comes from this network.
 *
 * The connecting peer alone is not enough: behind a reverse proxy every
 * request arrives from the proxy, which sits on the local network, so an
 * internet client would pass as local. So every address the forwarding
 * headers name has to be local too. A client can only make itself look less
 * local by adding headers, never more, so there is nothing to spoof — the
 * only requirement is that a proxy in front of Hamster passes the client on
 * in X-Forwarded-For, X-Real-IP or Forwarded, which they all do by default.
 */
export function isLocalRequest(peer: string | null | undefined, forwarded: string[]): boolean {
  return isLocalAddress(peer) && forwarded.every((address) => isLocalAddress(address))
}
