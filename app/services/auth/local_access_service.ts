import type { HttpContext } from '@adonisjs/core/http'
import AppSetting from '#models/app_setting'
import User from '#models/user'
import { forwardedAddresses, isLocalRequest } from '#utils/local_address'

export const LOCAL_ACCESS_SETTING_KEY = 'localAccess'

export interface LocalAccessOptions {
  enabled: boolean
}

/** Off by default: turning a login off is a decision, never a surprise. */
export const defaultLocalAccessOptions: LocalAccessOptions = { enabled: false }

/**
 * The setting is read on every request that needs a user, so it is cached
 * briefly rather than queried each time. `setOptions` clears it, so a change
 * made here takes effect immediately.
 */
const CACHE_MS = 30_000

/**
 * Lets requests from the local network in without a login, the way the *arr
 * apps' "Authentication required: disabled for local addresses" does.
 *
 * Hamster mostly runs on a home server and is used from the same network, so
 * a login there buys little and a session that runs out costs a lot. Requests
 * from anywhere else still have to sign in.
 *
 * A local request acts as the oldest administrator account. Hamster has
 * accounts with different rights, but a request with no login has no way to
 * say whose it is, so it gets the owner's — which is what "no login on this
 * network" means in practice.
 */
export class LocalAccessService {
  #cached: { options: LocalAccessOptions; at: number } | null = null

  async getOptions(): Promise<LocalAccessOptions> {
    if (this.#cached && Date.now() - this.#cached.at < CACHE_MS) {
      return this.#cached.options
    }
    const stored = await AppSetting.get<Partial<LocalAccessOptions>>(LOCAL_ACCESS_SETTING_KEY)
    const options = { ...defaultLocalAccessOptions, ...stored }
    this.#cached = { options, at: Date.now() }
    return options
  }

  async setOptions(options: LocalAccessOptions): Promise<void> {
    await AppSetting.set(LOCAL_ACCESS_SETTING_KEY, options)
    this.#cached = null
  }

  /** Whether this request comes from the local network, setting aside whether that matters. */
  isLocal(ctx: HttpContext): boolean {
    const header = (name: string) => ctx.request.header(name) ?? null
    return isLocalRequest(
      ctx.request.request.socket.remoteAddress,
      forwardedAddresses({
        forwardedFor: header('x-forwarded-for'),
        realIp: header('x-real-ip'),
        forwarded: header('forwarded'),
      })
    )
  }

  /**
   * Sign the request in as the owner when local access is on and the request
   * is local. Returns whether the request is now signed in; on false the
   * caller carries on with the normal login check.
   *
   * Callers only get here once the session check has failed, so a request
   * that already counts as authenticated was let in by an earlier middleware
   * on this same request (silent auth, an API key) and stays as it is.
   */
  async authenticate(ctx: HttpContext): Promise<boolean> {
    if (ctx.auth.isAuthenticated) return true
    const { enabled } = await this.getOptions()
    if (!enabled) return false
    if (!this.isLocal(ctx)) return false

    const owner = await User.query().where('isAdmin', true).orderBy('createdAt', 'asc').first()
    if (!owner) return false

    // Same custom flow as API-key auth: there is no session login to go
    // through, so the guard's read-only state is set directly.
    const auth = ctx.auth as unknown as Record<string, unknown>
    auth.user = owner
    auth.isAuthenticated = true
    auth.authenticatedViaGuard = 'web'
    return true
  }
}

export const localAccessService = new LocalAccessService()
