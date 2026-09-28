import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import { localAccessService } from '#services/auth/local_access_service'
import { appVersion } from '#services/system/app_info'
import { healthState, type HealthLevel } from '#services/system/health_state'
import { failingSettingsAreas, type SettingsStatusKey } from '#services/system/settings_status'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  share(ctx: HttpContext) {
    const { session, auth } = ctx as Partial<HttpContext>

    return {
      version: appVersion,
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      user: () => {
        const user = auth?.user
        if (!user) return undefined
        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          isAdmin: user.isAdmin,
          // Signed in by local access rather than a login, so the UI offers
          // "Sign in" where it would otherwise offer "Log out".
          autoSignedIn: localAccessService.isAutoSignedIn(ctx),
        }
      },
      // For the sidebar's Settings dot and the settings rail's per-item dots.
      // Read from the health monitor's memory cache — never a probe, never a
      // query — so it costs nothing per page.
      systemHealth: () => {
        if (!auth?.user?.isAdmin) return undefined
        return {
          healthLevel: healthState.isStale() ? 'error' : healthState.level,
          failedTasks: healthState.failedTasks.length,
          failing: failingSettingsAreas(healthState),
        }
      },
      flash: () => ({
        error: session?.flashMessages.get('error') ?? undefined,
        success: session?.flashMessages.get('success') ?? undefined,
      }),
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
  export interface SharedProps {
    version: string
    errors: Record<string, string> | { [errorBag: string]: Record<string, string> }
    user?: {
      id: string
      fullName: string | null
      email: string
      isAdmin: boolean
      autoSignedIn: boolean
    }
    flash: { error?: string; success?: string }
    /** Admins only. */
    systemHealth?: {
      healthLevel: HealthLevel
      failedTasks: number
      /** Settings areas with something down, by rail `statusKey`. */
      failing: SettingsStatusKey[]
    }
  }
}
