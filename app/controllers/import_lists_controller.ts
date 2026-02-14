import type { HttpContext } from '@adonisjs/core/http'
import ImportList from '#models/import_list'
import vine from '@vinejs/vine'
import { importListSyncService } from '#services/import_lists/import_list_sync'

const importListValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(255),
    type: vine.enum(['trakt_watchlist', 'trakt_list', 'imdb_list']),
    enabled: vine.boolean().optional(),
    settings: vine
      .object({
        traktListSlug: vine.string().optional(),
        traktUsername: vine.string().optional(),
        imdbListId: vine.string().optional(),
      })
      .optional(),
    mediaType: vine.enum(['movies', 'tv', 'music', 'books']),
    qualityProfileId: vine.string().optional(),
    rootFolderId: vine.string().optional(),
    autoAdd: vine.boolean().optional(),
    syncIntervalMinutes: vine.number().min(15).max(10080).optional(),
  })
)

export default class ImportListsController {
  async index({ response }: HttpContext) {
    const lists = await ImportList.query()
      .preload('qualityProfile')
      .preload('rootFolder')
      .orderBy('name', 'asc')

    return response.json(
      lists.map((list) => ({
        id: list.id,
        name: list.name,
        type: list.type,
        enabled: list.enabled,
        settings: list.settings,
        mediaType: list.mediaType,
        qualityProfileId: list.qualityProfileId,
        rootFolderId: list.rootFolderId,
        qualityProfile: list.qualityProfile
          ? { id: list.qualityProfile.id, name: list.qualityProfile.name }
          : null,
        rootFolder: list.rootFolder ? { id: list.rootFolder.id, path: list.rootFolder.path } : null,
        autoAdd: list.autoAdd,
        syncIntervalMinutes: list.syncIntervalMinutes,
        lastSyncedAt: list.lastSyncedAt?.toISO(),
      }))
    )
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(importListValidator)

    const list = await ImportList.create({
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? true,
      settings: data.settings ?? {},
      mediaType: data.mediaType,
      qualityProfileId: data.qualityProfileId ?? null,
      rootFolderId: data.rootFolderId ?? null,
      autoAdd: data.autoAdd ?? false,
      syncIntervalMinutes: data.syncIntervalMinutes ?? 360,
    })

    return response.created({
      id: list.id,
      name: list.name,
      type: list.type,
    })
  }

  async show({ params, response }: HttpContext) {
    const list = await ImportList.query()
      .where('id', params.id)
      .preload('qualityProfile')
      .preload('rootFolder')
      .first()

    if (!list) {
      return response.notFound({ error: 'Import list not found' })
    }

    return response.json({
      id: list.id,
      name: list.name,
      type: list.type,
      enabled: list.enabled,
      settings: list.settings,
      mediaType: list.mediaType,
      qualityProfileId: list.qualityProfileId,
      rootFolderId: list.rootFolderId,
      qualityProfile: list.qualityProfile
        ? { id: list.qualityProfile.id, name: list.qualityProfile.name }
        : null,
      rootFolder: list.rootFolder ? { id: list.rootFolder.id, path: list.rootFolder.path } : null,
      autoAdd: list.autoAdd,
      syncIntervalMinutes: list.syncIntervalMinutes,
      lastSyncedAt: list.lastSyncedAt?.toISO(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const list = await ImportList.find(params.id)
    if (!list) {
      return response.notFound({ error: 'Import list not found' })
    }

    const data = await request.validateUsing(importListValidator)

    list.merge({
      name: data.name,
      type: data.type,
      enabled: data.enabled ?? list.enabled,
      settings: data.settings ?? list.settings,
      mediaType: data.mediaType,
      qualityProfileId: data.qualityProfileId ?? list.qualityProfileId,
      rootFolderId: data.rootFolderId ?? list.rootFolderId,
      autoAdd: data.autoAdd ?? list.autoAdd,
      syncIntervalMinutes: data.syncIntervalMinutes ?? list.syncIntervalMinutes,
    })
    await list.save()

    return response.json({
      id: list.id,
      name: list.name,
      type: list.type,
    })
  }

  async destroy({ params, response }: HttpContext) {
    const list = await ImportList.find(params.id)
    if (!list) {
      return response.notFound({ error: 'Import list not found' })
    }

    await list.delete()
    return response.noContent()
  }

  /**
   * Manually trigger sync for a single import list
   */
  async sync({ params, response }: HttpContext) {
    const list = await ImportList.find(params.id)
    if (!list) {
      return response.notFound({ error: 'Import list not found' })
    }

    const result = await importListSyncService.syncList(list)
    return response.json(result)
  }

  /**
   * Sync all enabled import lists
   */
  async syncAll({ response }: HttpContext) {
    const results = await importListSyncService.syncAll()
    return response.json({
      results,
      totalAdded: results.reduce((sum, r) => sum + r.itemsAdded, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    })
  }
}
