/**
 * An external account the operator connects with the OAuth device flow
 * (RFC 8628): Hamster shows a short code, the user approves it on the
 * provider's site from any device, and Hamster polls until a token arrives.
 * No redirect URL is involved, so it works on a LAN-only install.
 *
 * Simkl is the first; anything else with a device flow implements this and
 * registers in `registry.ts` — routes and the settings UI are generic.
 */

export interface DeviceCode {
  userCode: string
  verificationUrl: string
  /** The same page with the code pre-filled, when the provider offers one. */
  verificationUrlComplete: string | null
  expiresIn: number
  interval: number
}

export type DevicePollResult =
  | { status: 'authorized'; username: string }
  | { status: 'pending' | 'slow_down' }
  | { status: 'expired' | 'denied' | 'invalid' | 'no-flow' }

export interface AccountStatus {
  /** Credentials the provider needs before connecting are in place. */
  configured: boolean
  account: { username: string } | null
}

export class AccountConfigError extends Error {}

export interface ConnectableAccount {
  id: string
  label: string
  status(): Promise<AccountStatus>
  startDeviceFlow(): Promise<DeviceCode>
  pollDeviceFlow(): Promise<DevicePollResult>
  disconnect(): Promise<void>
}
