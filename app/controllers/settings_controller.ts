import type { HttpContext } from '@adonisjs/core/http'
import AppSetting from '#models/app_setting'
import RootFolder from '#models/root_folder'
import QualityProfile from '#models/quality_profile'
import CustomFormat from '#models/custom_format'
import Indexer from '#models/indexer'
import ProwlarrConfig from '#models/prowlarr_config'
import DownloadClient from '#models/download_client'
import NotificationProvider from '#models/notification_provider'
import Webhook from '#models/webhook'
import User from '#models/user'
import ScheduledTask from '#models/scheduled_task'
import { localAccessService } from '#services/auth/local_access_service'
import { healthState, type HealthLevel } from '#services/system/health_state'
import { countFailedDeliveries24h } from '#services/system/delivery_failures'

const MEDIA_TYPES = ['movies', 'tv', 'music', 'books'] as const

/**
 * One fact set per settings area, for the Overview's status lines. Counts and
 * configuration from the database, reachability from the health monitor's
 * cache — never a live probe, and no folder scan, so the page is instant even
 * when a download client hangs.
 */
export interface SettingsOverview {
  media: {
    enabledTypes: string[]
    folders: number
    /** Folders the monitor found unreadable (error) or low on space (warning). */
    folderProblems: { path: string; status: 'warning' | 'error'; message: string }[]
  }
  quality: { profiles: number; customFormats: number }
  discovery: {
    hasTmdbKey: boolean
    /** Movies or TV is on, so a missing TMDB key actually hurts. */
    needsTmdbKey: boolean
    sources: string[]
  }
  indexers: {
    prowlarr: { configured: boolean; enabled: boolean; lastSyncedAt: string | null }
    direct: { enabled: number; total: number }
  }
  downloadClients: {
    id: string
    name: string
    enabled: boolean
    status: 'ok' | 'error' | 'unknown'
    message: string | null
  }[]
  notifications: { targets: number; enabled: number; failedDeliveries24h: number }
  users: { total: number; admins: number; localAccess: boolean }
  system: {
    level: HealthLevel
    stale: boolean
    databaseError: string | null
    failedTasks: number
    backup: { lastRunAt: string | null; lastStatus: string | null; enabled: boolean } | null
  }
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      return asArray(JSON.parse(value))
    } catch {
      return []
    }
  }
  return []
}

function total(rows: { $extras: Record<string, unknown> }[]): number {
  return Number(rows[0]?.$extras.total ?? 0)
}

export default class SettingsController {
  /**
   * /settings. Admins get the Overview (on phones it is also the drill-in
   * list); everyone else has only Profile to configure, so they go there.
   */
  async index({ auth, inertia, response, logger }: HttpContext) {
    if (!auth.user?.isAdmin) return response.redirect('/settings/profile')

    try {
      return inertia.render('settings/index', { overview: await this.overview() })
    } catch (error) {
      logger.error({ err: error }, 'Settings overview query failed')
      // The list still works as navigation; the status lines say they are missing.
      return inertia.render('settings/index', { overview: null })
    }
  }

  private async overview(): Promise<SettingsOverview> {
    const [
      enabledTypes,
      tmdbApiKey,
      recommendations,
      justwatchEnabled,
      folders,
      profiles,
      customFormats,
      prowlarr,
      indexers,
      clients,
      providers,
      webhooks,
      users,
      localAccess,
      backupTask,
      failedDeliveries24h,
    ] = await Promise.all([
      AppSetting.get<unknown>('enabledMediaTypes', ['movies']),
      AppSetting.get<string>('tmdbApiKey', ''),
      AppSetting.get<{ simklEnabled?: boolean; personalizedEnabled?: boolean }>(
        'recommendationSettings',
        {}
      ),
      AppSetting.get<boolean>('justwatchEnabled', false),
      RootFolder.query().count('* as total'),
      QualityProfile.query().count('* as total'),
      CustomFormat.query().count('* as total'),
      ProwlarrConfig.query().first(),
      Indexer.query().select('id', 'enabled'),
      DownloadClient.query().select('id', 'name', 'enabled').orderBy('name'),
      NotificationProvider.query().select('id', 'enabled'),
      Webhook.query().select('id', 'enabled'),
      User.query().select('id', 'isAdmin'),
      localAccessService.getOptions(),
      ScheduledTask.query().where('type', 'backup').first(),
      countFailedDeliveries24h(),
    ])

    const types = asArray(enabledTypes).filter((t) =>
      (MEDIA_TYPES as readonly string[]).includes(t)
    )
    const cached = healthState.result
    const probed = new Map((cached?.downloadClients ?? []).map((c) => [c.id, c]))
    const database = cached?.checks.find((c) => c.name === 'database')

    const sources = [
      justwatchEnabled ? 'JustWatch' : null,
      recommendations?.simklEnabled ? 'Simkl trending' : null,
      recommendations?.personalizedEnabled ? 'Personalised lanes' : null,
    ].filter((s): s is string => s !== null)

    const targets = [...providers, ...webhooks]

    return {
      media: {
        enabledTypes: types,
        folders: total(folders),
        folderProblems: (cached?.rootFolders ?? [])
          .filter((f) => f.status !== 'ok')
          .map((f) => ({
            path: f.path,
            status: f.status === 'error' ? 'error' : 'warning',
            message: f.message,
          })),
      },
      quality: { profiles: total(profiles), customFormats: total(customFormats) },
      discovery: {
        hasTmdbKey: Boolean(tmdbApiKey),
        needsTmdbKey: types.includes('movies') || types.includes('tv'),
        sources,
      },
      indexers: {
        prowlarr: {
          configured: Boolean(prowlarr),
          enabled: Boolean(prowlarr?.syncEnabled),
          lastSyncedAt: prowlarr?.lastSyncedAt?.toISO() ?? null,
        },
        direct: {
          enabled: indexers.filter((i) => i.enabled).length,
          total: indexers.length,
        },
      },
      downloadClients: clients.map((client) => {
        const probe = client.enabled ? probed.get(client.id) : undefined
        return {
          id: client.id,
          name: client.name,
          enabled: client.enabled,
          status: probe?.status ?? 'unknown',
          message: probe?.status === 'error' ? probe.message : null,
        }
      }),
      notifications: {
        targets: targets.length,
        enabled: targets.filter((t) => t.enabled).length,
        failedDeliveries24h,
      },
      users: {
        total: users.length,
        admins: users.filter((u) => u.isAdmin).length,
        localAccess: localAccess.enabled,
      },
      system: {
        level: healthState.level,
        stale: healthState.isStale(),
        databaseError: database && database.status !== 'ok' ? database.message : null,
        failedTasks: healthState.failedTasks.length,
        backup: backupTask
          ? {
              lastRunAt: backupTask.lastRunAt?.toISO() ?? null,
              lastStatus: backupTask.lastStatus,
              enabled: backupTask.enabled,
            }
          : null,
      },
    }
  }
}
