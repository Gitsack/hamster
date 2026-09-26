import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiKey from '#models/api_key'
import { localAccessService } from '#services/auth/local_access_service'
import { signInForRequest } from '#services/auth/sign_in_for_request'
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

        await signInForRequest(ctx, apiKey.user)

        return next()
      }
    }

    // Fall through to session auth, then to local access
    if (!(await ctx.auth.check()) && (await localAccessService.authenticate(ctx))) {
      return next()
    }
    await ctx.auth.authenticateUsing(undefined, { loginRoute: this.redirectTo })
    return next()
  }
}
