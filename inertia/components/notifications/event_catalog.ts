/**
 * The events a notification target can fire on, and the media types a push
 * target can filter by. Both backends (notification providers and webhooks)
 * store the same nine `on*` flags, so one catalog drives the picker, the row
 * summary and the delivery log labels. Pure, so it is tested directly.
 */

export type EventKey =
  | 'onGrab'
  | 'onDownloadComplete'
  | 'onImportComplete'
  | 'onImportFailed'
  | 'onUpgrade'
  | 'onRename'
  | 'onDelete'
  | 'onHealthIssue'
  | 'onHealthRestored'

export type MediaKey = 'includeMusic' | 'includeMovies' | 'includeTv' | 'includeBooks'

export type EventFlags = Record<EventKey, boolean>
export type MediaFlags = Record<MediaKey, boolean>

export interface EventDefinition {
  key: EventKey
  /** The event type string the backends log ("import.failed"). */
  eventType: string
  /** Sentence case, as it reads in the picker and the delivery log. */
  label: string
  /** One short line under the label in the picker. */
  description: string
}

export interface EventGroup {
  id: 'downloads' | 'imports' | 'library' | 'health'
  label: string
  events: readonly EventDefinition[]
}

export const EVENT_GROUPS: readonly EventGroup[] = [
  {
    id: 'downloads',
    label: 'Downloads',
    events: [
      {
        key: 'onGrab',
        eventType: 'grab',
        label: 'Grabbed',
        description: 'A release was sent to the download client.',
      },
      {
        key: 'onDownloadComplete',
        eventType: 'download.completed',
        label: 'Download finished',
        description: 'The client finished; the import has not run yet.',
      },
    ],
  },
  {
    id: 'imports',
    label: 'Imports',
    events: [
      {
        key: 'onImportComplete',
        eventType: 'import.completed',
        label: 'Imported',
        description: 'Files landed in the library.',
      },
      {
        key: 'onImportFailed',
        eventType: 'import.failed',
        label: 'Import failed',
        description: 'The one worth keeping on: nothing else tells you.',
      },
      {
        key: 'onUpgrade',
        eventType: 'upgrade',
        label: 'Upgraded',
        description: 'A better release replaced an existing file.',
      },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    events: [
      {
        key: 'onRename',
        eventType: 'rename',
        label: 'Renamed',
        description: 'Files were renamed to the naming pattern.',
      },
      {
        key: 'onDelete',
        eventType: 'delete',
        label: 'Deleted',
        description: 'Media was removed from disk.',
      },
    ],
  },
  {
    id: 'health',
    label: 'Health',
    events: [
      {
        key: 'onHealthIssue',
        eventType: 'health.issue',
        label: 'Health issue',
        description: 'A client, indexer or folder stopped working.',
      },
      {
        key: 'onHealthRestored',
        eventType: 'health.restored',
        label: 'Health restored',
        description: 'The issue cleared. Also what a test sends.',
      },
    ],
  },
]

export const EVENT_KEYS: readonly EventKey[] = EVENT_GROUPS.flatMap((group) =>
  group.events.map((event) => event.key)
)

export const MEDIA_TYPES: readonly { key: MediaKey; label: string }[] = [
  { key: 'includeMovies', label: 'Movies' },
  { key: 'includeTv', label: 'TV' },
  { key: 'includeMusic', label: 'Music' },
  { key: 'includeBooks', label: 'Books' },
]

/**
 * What a new target listens for, whatever its kind. The two backends disagree
 * (providers default Grab off, webhooks on), so the UI decides once: the
 * outcomes an operator acts on are on, the chatter is off. Grab and Download
 * finished are each followed minutes later by Imported, so leaving them on
 * doubles every message.
 */
export const DEFAULT_EVENTS: Readonly<EventFlags> = {
  onGrab: false,
  onDownloadComplete: false,
  onImportComplete: true,
  onImportFailed: true,
  onUpgrade: true,
  onRename: false,
  onDelete: false,
  onHealthIssue: true,
  onHealthRestored: true,
}

/** What a media server library refresh needs: anything that changes files on disk. */
export const REFRESH_EVENTS: Readonly<EventFlags> = {
  onGrab: false,
  onDownloadComplete: false,
  onImportComplete: true,
  onImportFailed: false,
  onUpgrade: true,
  onRename: true,
  onDelete: true,
  onHealthIssue: false,
  onHealthRestored: false,
}

export const ALL_MEDIA: Readonly<MediaFlags> = {
  includeMusic: true,
  includeMovies: true,
  includeTv: true,
  includeBooks: true,
}

/** Read the nine flags off an API record, treating anything missing as off. */
export function pickEvents(record: Partial<Record<EventKey, unknown>>): EventFlags {
  const flags = {} as EventFlags
  for (const key of EVENT_KEYS) flags[key] = record[key] === true
  return flags
}

export function pickMedia(record: Partial<Record<MediaKey, unknown>>): MediaFlags {
  const flags = {} as MediaFlags
  for (const { key } of MEDIA_TYPES) flags[key] = record[key] !== false
  return flags
}

/**
 * "Imports, Health issue, Grabbed": a whole group reads as the group's name,
 * a partial group lists its events. Every event on is "All events".
 */
export function summarizeEvents(flags: EventFlags): string {
  const on = EVENT_KEYS.filter((key) => flags[key])
  if (on.length === 0) return 'No events'
  if (on.length === EVENT_KEYS.length) return 'All events'

  const parts: string[] = []
  for (const group of EVENT_GROUPS) {
    const enabled = group.events.filter((event) => flags[event.key])
    if (enabled.length === 0) continue
    if (enabled.length === group.events.length) parts.push(group.label)
    else parts.push(...enabled.map((event) => event.label))
  }
  return parts.join(', ')
}

/** "Movies, TV only"; null when every type is included (the default, not worth a word). */
export function summarizeMedia(flags: MediaFlags): string | null {
  const on = MEDIA_TYPES.filter(({ key }) => flags[key])
  if (on.length === MEDIA_TYPES.length) return null
  if (on.length === 0) return 'No media types'
  return `${on.map(({ label }) => label).join(', ')} only`
}

const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_GROUPS.flatMap((group) => group.events.map((event) => [event.eventType, event.label]))
)

/** The label for a logged event type; unknown types show as logged. */
export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType
}
