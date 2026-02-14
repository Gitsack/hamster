import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Admin middleware denies access to non-admin users.
 * Must be used after the auth middleware so that ctx.auth.user is available.
 */
export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user

    if (!user || !user.isAdmin) {
      if (
        ctx.request.accepts(['html', 'json']) === 'json' ||
        ctx.request.url().startsWith('/api/')
      ) {
        return ctx.response.forbidden({
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required',
          },
        })
      }

      return ctx.response.redirect('/')
    }

    return next()
  }
}
