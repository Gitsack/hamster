import type { HttpContext } from '@adonisjs/core/http'
import { justwatchService } from '#services/metadata/justwatch_service'
import AppSetting from '#models/app_setting'

export default class JustWatchController {
  async streamingAvailability({ request, response }: HttpContext) {
    const title = request.input('title')
    const year = request.input('year')
    const contentType = request.input('contentType') as 'movie' | 'show'

    if (!title || !year || !contentType) {
      return response.badRequest({ error: 'title, year, and contentType are required' })
    }

    const justwatchEnabled = await AppSetting.get<boolean>('justwatchEnabled', false)
    if (!justwatchEnabled) {
      return response.json({ offers: [] })
    }

    const offers = await justwatchService.getStreamingAvailability(
      title,
      Number.parseInt(year),
      contentType
    )

    return response.json({ offers })
  }
}
