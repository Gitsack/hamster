import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'))

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  share(ctx: HttpContext) {
    const { session, auth } = ctx as Partial<HttpContext>

    return {
      version: packageJson.version,
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      user: ctx.inertia.always(() => {
        const user = auth?.user
        if (!user) return undefined
        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          isAdmin: user.isAdmin,
        }
      }),
      flash: ctx.inertia.always(() => ({
        error: session?.flashMessages.get('error') ?? undefined,
        success: session?.flashMessages.get('success') ?? undefined,
      })),
    }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    const output = await next()
    this.dispose(ctx)

    return output
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
