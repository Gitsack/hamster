import type { HttpContext } from '@adonisjs/core/http'
import { fileOrganizerService } from '#services/media/file_organizer_service'

export default class RenameController {
  /**
   * Preview or execute movie rename
   * POST /api/v1/movies/:id/rename?preview=true
   */
  async renameMovie({ params, request, response }: HttpContext) {
    const preview = request.input('preview') === 'true'

    if (preview) {
      const items = await fileOrganizerService.previewRenameMovie(params.id)
      return response.json({ preview: true, items })
    }

    const result = await fileOrganizerService.renameMovie(params.id)
    return response.json({
      preview: false,
      moved: result.moved,
      errors: result.errors,
    })
  }

  /**
   * Preview or execute TV show episode rename
   * POST /api/v1/tvshows/:id/rename?preview=true
   */
  async renameTvShow({ params, request, response }: HttpContext) {
    const preview = request.input('preview') === 'true'

    if (preview) {
      const items = await fileOrganizerService.previewRenameEpisodes(params.id)
      return response.json({ preview: true, items })
    }

    const result = await fileOrganizerService.renameEpisodes(params.id)
    return response.json({
      preview: false,
      moved: result.moved,
      errors: result.errors,
    })
  }

  /**
   * Preview or execute artist file rename (all tracks)
   * POST /api/v1/artists/:id/rename?preview=true
   */
  async renameArtist({ params, request, response }: HttpContext) {
    const preview = request.input('preview') === 'true'

    if (preview) {
      const items = await fileOrganizerService.previewRenameArtist(params.id)
      return response.json({ preview: true, items })
    }

    const result = await fileOrganizerService.renameArtist(params.id)
    return response.json({
      preview: false,
      moved: result.moved,
      errors: result.errors,
    })
  }

  /**
   * Preview or execute author book file rename
   * POST /api/v1/authors/:id/rename?preview=true
   */
  async renameAuthor({ params, request, response }: HttpContext) {
    const preview = request.input('preview') === 'true'

    if (preview) {
      const items = await fileOrganizerService.previewRenameBooks(params.id)
      return response.json({ preview: true, items })
    }

    const result = await fileOrganizerService.renameBooks(params.id)
    return response.json({
      preview: false,
      moved: result.moved,
      errors: result.errors,
    })
  }
}
