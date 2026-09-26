import type { HttpContext } from '@adonisjs/core/http'
import type User from '#models/user'

/**
 * Treat this one request as signed in as `user`, without a session login.
 *
 * For flows that decide who the user is on their own — an API key, a request
 * from the local network. `ctx.auth` only has getters for its state, so
 * assigning `ctx.auth.user` throws "Attempted to assign to readonly property"
 * in strict-mode ESM. The session guard's own fields are writable: they are
 * set here, and `check()` then lets the authenticator record that the guard
 * signed the request in. Nothing is written to the session.
 */
export async function signInForRequest(ctx: HttpContext, user: User): Promise<void> {
  const guard = ctx.auth.use()
  guard.user = user
  guard.authenticationAttempted = true
  guard.isAuthenticated = true
  guard.isLoggedOut = false
  await ctx.auth.check()
}
