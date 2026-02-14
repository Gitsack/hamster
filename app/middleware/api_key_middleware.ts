import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiKey from '#models/api_key'
import { DateTime } from 'luxon'

/**
 * API key authentication middleware.
 * Checks for X-Api-Key header or apikey query parameter.
 * If a valid key is found, sets the associated user as authenticated.
 * If not found, falls through to session auth.
 */
export default class ApiKeyMiddleware {
  redirectTo = '/login'

  async handle(ctx: HttpContext, next: NextFn) {
    const apiKeyValue =
      ctx.request.header('X-Api-Key') || (ctx.request.qs().apikey as string | undefined)

    if (apiKeyValue) {
      const apiKey = await ApiKey.query().where('key', apiKeyValue).preload('user').first()

      if (apiKey) {
        // Update last_used_at without blocking the request
        apiKey.lastUsedAt = DateTime.now()
        apiKey.save().catch(() => {})

        // Set authenticated state on the auth object.
        // We bypass the guard's read-only properties since API key auth
        // is a custom flow that doesn't go through session login.
        const auth = ctx.auth as unknown as Record<string, unknown>
        auth.user = apiKey.user
        auth.isAuthenticated = true
        auth.authenticatedViaGuard = 'web'

        return next()
      }
    }

    // Fall through to session auth
    await ctx.auth.authenticateUsing(undefined, { loginRoute: this.redirectTo })
    return next()
  }
}
