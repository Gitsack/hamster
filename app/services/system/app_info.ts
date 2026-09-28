import { readFileSync } from 'node:fs'

/**
 * The running version, read once from package.json. `npm_package_version` is
 * only set when the process is started through npm, so the container (which
 * runs `node bin/server.js`) reported a made-up "1.0.0" from it. package.json
 * sits three levels up both in the source tree and in the build output.
 */
function readVersion(): string {
  try {
    const raw = readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8')
    const version = (JSON.parse(raw) as { version?: unknown }).version
    return typeof version === 'string' && version ? version : 'unknown'
  } catch {
    return 'unknown'
  }
}

export const appVersion = readVersion()
