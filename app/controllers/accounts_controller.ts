import type { HttpContext } from '@adonisjs/core/http'
import { findAccount } from '#services/accounts/registry'
import { AccountConfigError } from '#services/accounts/types'
import { forYouService } from '#services/recommendations/for_you_service'

/**
 * Connecting external accounts with the device flow. Generic over every
 * provider in `#services/accounts/registry`; the :provider param picks one.
 */
export default class AccountsController {
  async startDevice({ params, response }: HttpContext) {
    const account = findAccount(params.provider)
    if (!account) return response.notFound({ error: 'Unknown account provider' })
    try {
      return response.json(await account.startDeviceFlow())
    } catch (error) {
      if (error instanceof AccountConfigError) return response.badRequest({ error: error.message })
      return response.badGateway({
        error: `${account.label} is unreachable. Try again in a moment.`,
      })
    }
  }

  async pollDevice({ params, response }: HttpContext) {
    const account = findAccount(params.provider)
    if (!account) return response.notFound({ error: 'Unknown account provider' })
    const result = await account.pollDeviceFlow().catch(() => ({ status: 'pending' as const }))
    if (result.status === 'authorized') forYouService.invalidateAll()
    return response.json(result)
  }

  async disconnect({ params, response }: HttpContext) {
    const account = findAccount(params.provider)
    if (!account) return response.notFound({ error: 'Unknown account provider' })
    await account.disconnect()
    forYouService.invalidateAll()
    return response.noContent()
  }
}
