import AppSetting from '#models/app_setting'
import {
  AccountConfigError,
  type AccountStatus,
  type ConnectableAccount,
  type DeviceCode,
  type DevicePollResult,
} from '#services/accounts/types'
import { simklClientId, simklGet, simklOAuthPost } from '#services/simkl/simkl_client'

const SESSION_KEY = 'simklSession'
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'
/** Refresh a day before expiry; access tokens live seven days. */
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000

interface StoredSession {
  accessToken: string
  refreshToken: string
  /** Epoch milliseconds. */
  expiresAt: number
  username: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

interface PendingDevice {
  deviceCode: string
  expiresAt: number
}

/**
 * Simkl AUTH V2 with the device flow. It needs only the app's client ID — no
 * secret, no redirect URI — and Simkl registration is free.
 *
 * Simkl allows one live access token per grant: a refresh invalidates the
 * previous token at once. So only one Hamster instance should hold the
 * connection; two (a dev server and the container) would keep logging each
 * other out.
 */
class SimklAccount implements ConnectableAccount {
  readonly id = 'simkl'
  readonly label = 'Simkl'
  private pending: PendingDevice | null = null
  private refreshing: Promise<StoredSession | null> | null = null

  async status(): Promise<AccountStatus> {
    const session = await AppSetting.get<StoredSession | null>(SESSION_KEY, null)
    return {
      configured: !!(await simklClientId()),
      account: session?.accessToken ? { username: session.username } : null,
    }
  }

  async startDeviceFlow(): Promise<DeviceCode> {
    const clientId = await simklClientId()
    if (!clientId) throw new AccountConfigError('Set the Simkl client ID first.')

    const res = await simklOAuthPost('/oauth2/device', { client_id: clientId, scope: 'media:read' })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error_description?: string }
      throw new AccountConfigError(
        res.status === 401
          ? 'Simkl does not accept this client ID for sign-in. Register an AUTH V2 app at simkl.com/settings/developer and use its client ID.'
          : body.error_description || `Simkl refused to start sign-in (${res.status}).`
      )
    }
    const data = (await res.json()) as {
      device_code: string
      user_code: string
      verification_uri: string
      verification_uri_complete?: string
      expires_in: number
      interval: number
    }
    this.pending = {
      deviceCode: data.device_code,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
    return {
      userCode: data.user_code,
      verificationUrl: data.verification_uri,
      verificationUrlComplete: data.verification_uri_complete ?? null,
      expiresIn: data.expires_in,
      interval: data.interval,
    }
  }

  async pollDeviceFlow(): Promise<DevicePollResult> {
    const pending = this.pending
    if (!pending) return { status: 'no-flow' }
    // Simkl never reports a refusal — declining just stays "pending" — so the
    // expiry is the only thing that ends an abandoned sign-in.
    if (Date.now() > pending.expiresAt) {
      this.pending = null
      return { status: 'expired' }
    }

    const res = await simklOAuthPost('/oauth2/token', {
      grant_type: DEVICE_GRANT,
      client_id: await simklClientId(),
      device_code: pending.deviceCode,
    })

    if (res.ok) {
      this.pending = null
      const session = await this.store((await res.json()) as TokenResponse)
      return { status: 'authorized', username: session.username }
    }

    const body = (await res.json().catch(() => ({}))) as { error?: string }
    switch (body.error) {
      case 'authorization_pending':
        return { status: 'pending' }
      case 'slow_down':
        return { status: 'slow_down' }
      case 'expired_token':
        this.pending = null
        return { status: 'expired' }
      default:
        this.pending = null
        return { status: 'invalid' }
    }
  }

  private async store(token: TokenResponse): Promise<StoredSession> {
    const previous = await AppSetting.get<StoredSession | null>(SESSION_KEY, null)
    const username = await simklGet<{ user?: { name?: string } }>(
      '/users/settings',
      {},
      token.access_token
    )
      .then((s) => s.user?.name ?? null)
      .catch(() => null)
    const session: StoredSession = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      username: username ?? previous?.username ?? 'Simkl user',
    }
    await AppSetting.set(SESSION_KEY, session)
    return session
  }

  /** A token valid for at least the next day, refreshed as needed; null if not connected. */
  async getAccessToken(): Promise<string | null> {
    const session = await AppSetting.get<StoredSession | null>(SESSION_KEY, null)
    if (!session?.accessToken) return null
    if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) return session.accessToken

    // Refresh tokens rotate the access token; never run two refreshes at once.
    this.refreshing ??= this.refresh(session).finally(() => {
      this.refreshing = null
    })
    const refreshed = await this.refreshing
    return refreshed?.accessToken ?? null
  }

  private async refresh(session: StoredSession): Promise<StoredSession | null> {
    const res = await simklOAuthPost('/oauth2/token', {
      grant_type: 'refresh_token',
      client_id: await simklClientId(),
      refresh_token: session.refreshToken,
    }).catch(() => null)

    // Network trouble: keep using the current token while it lasts.
    if (!res) return session.expiresAt > Date.now() ? session : null
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) await this.forget()
      return null
    }
    return this.store((await res.json()) as TokenResponse)
  }

  async disconnect() {
    const session = await AppSetting.get<StoredSession | null>(SESSION_KEY, null)
    if (session?.accessToken) {
      await simklOAuthPost('/oauth2/revoke', {
        token: session.refreshToken,
        client_id: await simklClientId(),
      }).catch(() => {})
    }
    await this.forget()
  }

  async forget() {
    this.pending = null
    await AppSetting.set(SESSION_KEY, null)
    await AppSetting.set('simklLibrary', null)
  }
}

export const simklAccount = new SimklAccount()
