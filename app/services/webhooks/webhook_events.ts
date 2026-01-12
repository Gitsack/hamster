import type { MediaType } from '#models/app_setting'

/**
 * Base payload for all webhook events
 */
export interface BaseWebhookPayload {
  eventType: string
  instanceName: string
  applicationUrl?: string
}

/**
 * Media item info included in payloads
 */
export interface MediaInfo {
  id: string
  title: string
  year?: number
  mediaType: MediaType
  posterUrl?: string
  overview?: string
}

/**
 * Release/download info included in payloads
 */
export interface ReleaseInfo {
  title: string
  indexer: string
  quality?: string
  size?: number
  protocol: 'usenet' | 'torrent'
  downloadUrl?: string
  guid?: string
}

/**
 * File info for import events
 */
export interface FileInfo {
  path: string
  relativePath: string
  size: number
  quality?: string
}

/**
 * Grab event - when a release is sent to download client
 */
export interface GrabEventPayload extends BaseWebhookPayload {
  eventType: 'grab'
  media: MediaInfo
  release: ReleaseInfo
  downloadClient: string
  downloadId: string
}

/**
 * Download completed event - download finished in client
 */
export interface DownloadCompletedEventPayload extends BaseWebhookPayload {
  eventType: 'download.completed'
  media: MediaInfo
  release: ReleaseInfo
  downloadClient: string
  downloadId: string
  outputPath: string
}

/**
 * Import completed event - files imported to library
 */
export interface ImportCompletedEventPayload extends BaseWebhookPayload {
  eventType: 'import.completed'
  media: MediaInfo
  files: FileInfo[]
  isUpgrade: boolean
  previousQuality?: string
}

/**
 * Import failed event
 */
export interface ImportFailedEventPayload extends BaseWebhookPayload {
  eventType: 'import.failed'
  media: MediaInfo
  release?: ReleaseInfo
  errorMessage: string
  downloadId?: string
}

/**
 * Upgrade event - higher quality version imported
 */
export interface UpgradeEventPayload extends BaseWebhookPayload {
  eventType: 'upgrade'
  media: MediaInfo
  files: FileInfo[]
  previousQuality: string
  newQuality: string
}

/**
 * Rename event - file renamed
 */
export interface RenameEventPayload extends BaseWebhookPayload {
  eventType: 'rename'
  media: MediaInfo
  previousPath: string
  newPath: string
}

/**
 * Delete event - media deleted from library
 */
export interface DeleteEventPayload extends BaseWebhookPayload {
  eventType: 'delete'
  media: MediaInfo
  deletedFiles: boolean
  reason?: string
}

/**
 * Health issue event
 */
export interface HealthIssueEventPayload extends BaseWebhookPayload {
  eventType: 'health.issue'
  level: 'warning' | 'error'
  source: string
  message: string
  wikiUrl?: string
}

/**
 * Health restored event
 */
export interface HealthRestoredEventPayload extends BaseWebhookPayload {
  eventType: 'health.restored'
  source: string
  message: string
}

/**
 * Union of all webhook payloads
 */
export type WebhookPayload =
  | GrabEventPayload
  | DownloadCompletedEventPayload
  | ImportCompletedEventPayload
  | ImportFailedEventPayload
  | UpgradeEventPayload
  | RenameEventPayload
  | DeleteEventPayload
  | HealthIssueEventPayload
  | HealthRestoredEventPayload

/**
 * Helper to create base payload
 */
export function createBasePayload(eventType: string): BaseWebhookPayload {
  return {
    eventType,
    instanceName: process.env.INSTANCE_NAME || 'Hamster',
    applicationUrl: process.env.APP_URL,
  }
}
