import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SettingsPage } from '@/components/settings/settings-page'
import { SaveBar, useFormDraft } from '@/components/settings/save-bar'
import { TmdbKeyDialog } from '@/components/settings/tmdb-key-dialog'
import {
  SubtitlePruningSection,
  parseMaxTracks,
  useSubtitlePruning,
} from '@/components/settings/subtitle-pruning-section'
import {
  getJson,
  responseError,
  type FolderHealth,
  type HealthSummary,
} from '@/components/system/system_api'
import { useLibrarySettings } from '@/hooks/use_library_settings'
import {
  MEDIA_TYPES,
  MEDIA_TYPE_INFO,
  type MediaType,
  type NamingPatternsData,
  type RootFolder,
} from './library_catalog'
import { MediaTypesSection, type MediaTypeRowState } from './media-types-section'
import { NamingSection, type NamingDraft, type NamingFieldErrors } from './naming-section'
import { PlaybackSection, usePlaybackSettings } from './playback-section'
import { RootFolderSheet } from './root-folder-sheet'

/** How often a running scan is checked, and when the page stops waiting on it. */
const SCAN_POLL_MS = 3_000
const SCAN_GIVE_UP_MS = 15 * 60_000

type MediaForm = {
  naming: NamingDraft | null
  maxTracks: string
}

function sameRecord(a: Record<string, string> | undefined, b: Record<string, string> | undefined) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])
  for (const key of keys) if ((a ?? {})[key] !== (b ?? {})[key]) return false
  return true
}

/** A naming save the server refused, with its per-field reasons. */
class NamingRejected extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string>
  ) {
    super(message)
  }
}

async function putNamingPatterns(
  mediaType: MediaType,
  patterns: Record<string, string>
): Promise<{ patterns: Record<string, string>; examples: Record<string, string> }> {
  let response: Response
  try {
    response = await fetch('/api/v1/settings/naming-patterns', {
      method: 'PUT',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType, patterns }),
    })
  } catch {
    throw new Error('Hamster did not answer. Check that it is still running.')
  }
  if (response.ok) return response.json()
  const body = await response
    .clone()
    .json()
    .catch(() => null)
  const details: Record<string, string[]> | undefined = body?.details
  if (details && typeof details === 'object') {
    const fields = Object.fromEntries(
      Object.entries(details).map(([field, reasons]) => [
        field,
        Array.isArray(reasons) ? reasons.join('; ') : String(reasons),
      ])
    )
    throw new NamingRejected(Object.values(fields)[0] ?? 'Invalid patterns', fields)
  }
  throw new Error(await responseError(response))
}

/** The health monitor's cached view of each folder: free space and the low-space verdict. */
function useFolderHealth() {
  const [folders, setFolders] = useState<FolderHealth[]>([])
  useEffect(() => {
    let live = true
    getJson<HealthSummary>('/api/v1/system/health-summary')
      .then((summary) => {
        if (live) setFolders(summary.rootFolders ?? [])
      })
      .catch(() => {
        // Space is extra detail; without it the rows still say whether each folder is readable.
      })
    return () => {
      live = false
    }
  }, [])
  return folders
}

/**
 * Settings → Media: media types and their folders, file naming, the import
 * clean-up and playback. Switches save as they change; the naming patterns and
 * the track limit are typed, so they wait for the save bar.
 */
export function MediaSettings() {
  const library = useLibrarySettings({ settings: true, rootFolders: true, naming: true })
  const subtitles = useSubtitlePruning()
  const playback = usePlaybackSettings()
  const folderHealth = useFolderHealth()

  const [tmdbOpen, setTmdbOpen] = useState(false)
  const [folderType, setFolderType] = useState<MediaType | null>(null)
  const [scanning, setScanning] = useState<ReadonlySet<string>>(new Set())
  const [namingErrors, setNamingErrors] = useState<NamingFieldErrors>({})

  const settings = library.settings.data
  const rootFolders = library.rootFolders.data
  const naming = library.naming.data

  // --- Typed fields: naming patterns and the track limit share one save bar ---

  const saved = useMemo<MediaForm>(
    () => ({
      naming: naming?.patterns ?? null,
      maxTracks: subtitles.options ? String(subtitles.options.maxTracks) : '',
    }),
    [naming?.patterns, subtitles.options]
  )
  const form = useFormDraft<MediaForm>(saved)

  const maxTracksError =
    form.draft.maxTracks !== saved.maxTracks && parseMaxTracks(form.draft.maxTracks) === null
      ? 'Enter a whole number from 1 to 100.'
      : null

  const changePattern = (type: MediaType, field: string, value: string) => {
    if (!form.draft.naming) return
    form.set('naming', {
      ...form.draft.naming,
      [type]: { ...form.draft.naming[type], [field]: value },
    })
    const key = `${type}.${field}`
    if (namingErrors[key]) {
      setNamingErrors(({ [key]: _, ...rest }) => rest)
    }
  }

  const save = () =>
    form.save(async (draft) => {
      // Check everything first, so an invalid field never leaves half a save behind.
      let maxTracks: number | null = null
      if (draft.maxTracks !== saved.maxTracks) {
        maxTracks = parseMaxTracks(draft.maxTracks)
        if (maxTracks === null) {
          throw new Error('The track limit must be a whole number from 1 to 100.')
        }
      }

      const failures: string[] = []
      const fieldErrors: NamingFieldErrors = {}
      const stored = library.naming.data
      if (draft.naming && stored) {
        for (const type of MEDIA_TYPES) {
          const edited = draft.naming[type]
          if (!edited || sameRecord(edited, stored.patterns[type])) continue
          try {
            const result = await putNamingPatterns(type, edited)
            library.update('naming', (data: NamingPatternsData) => ({
              ...data,
              patterns: { ...data.patterns, [type]: result.patterns },
              examples: { ...data.examples, [type]: result.examples },
            }))
          } catch (err) {
            if (err instanceof NamingRejected) {
              for (const [field, reason] of Object.entries(err.fields)) {
                fieldErrors[`${type}.${field}`] = reason
              }
            }
            const reason = err instanceof Error ? err.message : 'not saved'
            failures.push(`${MEDIA_TYPE_INFO[type].label} naming: ${reason}`)
          }
        }
      }
      setNamingErrors(fieldErrors)

      if (maxTracks !== null) {
        try {
          await subtitles.update({ maxTracks })
        } catch (err) {
          failures.push(`Track limit: ${err instanceof Error ? err.message : 'not saved'}`)
        }
      }

      if (failures.length === 1) throw new Error(failures[0])
      if (failures.length > 1) {
        throw new Error(`${failures.length} changes were not saved. ${failures.join(' · ')}`)
      }
    })

  const discard = () => {
    form.discard()
    setNamingErrors({})
  }

  // --- Media types, folders and scans ---

  const pollTimers = useRef(new Set<number>())
  useEffect(() => {
    const timers = pollTimers.current
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [])

  const setFolderScanning = useCallback((id: string, on: boolean) => {
    setScanning((current) => {
      if (current.has(id) === on) return current
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const rescan = async (folder: RootFolder) => {
    setFolderScanning(folder.id, true)
    try {
      const response = await fetch(`/api/v1/rootfolders/${folder.id}/scan`, { method: 'POST' })
      if (response.status === 409) {
        toast.info('A scan of this folder is already running. It shows here until it finishes.')
      } else if (!response.ok) {
        setFolderScanning(folder.id, false)
        toast.error('The scan did not start', { description: await responseError(response) })
        return
      } else {
        toast.success(`Scanning ${folder.path}`)
      }
    } catch {
      setFolderScanning(folder.id, false)
      toast.error('The scan did not start', {
        description: 'Hamster did not answer. Check that it is still running.',
      })
      return
    }

    // The scan runs in the background; watch its status until it stops.
    const startedAt = Date.now()
    const poll = async () => {
      try {
        const status = await getJson<{ isScanning: boolean }>(
          `/api/v1/rootfolders/${folder.id}/scan-status`
        )
        if (!status.isScanning) {
          setFolderScanning(folder.id, false)
          toast.success(`Finished scanning ${folder.path}`)
          void library.reload('rootFolders')
          return
        }
        if (Date.now() - startedAt > SCAN_GIVE_UP_MS) {
          setFolderScanning(folder.id, false)
          return
        }
        const timer = window.setTimeout(() => {
          pollTimers.current.delete(timer)
          void poll()
        }, SCAN_POLL_MS)
        pollTimers.current.add(timer)
      } catch {
        setFolderScanning(folder.id, false)
      }
    }
    const timer = window.setTimeout(() => {
      pollTimers.current.delete(timer)
      void poll()
    }, SCAN_POLL_MS)
    pollTimers.current.add(timer)
  }

  const toggleType = async (type: MediaType, enabled: boolean) => {
    if (enabled && MEDIA_TYPE_INFO[type].needsTmdbKey && !settings?.hasTmdbApiKey) {
      setTmdbOpen(true)
      throw new Error(`${MEDIA_TYPE_INFO[type].label} need a TMDB key first.`)
    }
    await library.setMediaTypeEnabled(type, enabled)
  }

  const rows: MediaTypeRowState[] | null =
    settings && rootFolders
      ? MEDIA_TYPES.map((type) => {
          const folder = rootFolders.find((f) => f.mediaType === type) ?? null
          return {
            type,
            enabled: settings.enabledMediaTypes.includes(type),
            folder,
            health: folder
              ? (folderHealth.find((h) => h.id === folder.id) ??
                folderHealth.find((h) => h.path === folder.path) ??
                null)
              : null,
            scanning: folder ? scanning.has(folder.id) : false,
          }
        })
      : null

  const typesError = library.settings.error ?? library.rootFolders.error
  const enabledTypes = settings
    ? MEDIA_TYPES.filter((type) => settings.enabledMediaTypes.includes(type))
    : []
  const editingFolder = folderType
    ? (rootFolders?.find((f) => f.mediaType === folderType) ?? null)
    : null

  const ready =
    !library.settings.loading &&
    !library.rootFolders.loading &&
    !library.naming.loading &&
    !subtitles.loading &&
    !playback.loading

  return (
    <SettingsPage
      title="Media"
      description="Media types and their folders, file naming, import clean-up and playback."
      ready={ready}
    >
      <MediaTypesSection
        rows={rows}
        loading={library.settings.loading || library.rootFolders.loading}
        error={typesError}
        onRetry={() => {
          if (library.settings.error) void library.reload('settings')
          if (library.rootFolders.error) void library.reload('rootFolders')
        }}
        hasTmdbKey={Boolean(settings?.hasTmdbApiKey)}
        onToggle={toggleType}
        onEditFolder={setFolderType}
        onRescan={(folder) => void rescan(folder)}
        onAddTmdbKey={() => setTmdbOpen(true)}
      />

      <NamingSection
        naming={naming}
        loading={library.naming.loading || library.settings.loading}
        error={library.naming.error}
        onRetry={() => void library.reload('naming')}
        enabledTypes={enabledTypes}
        draft={form.draft.naming}
        onChange={changePattern}
        fieldErrors={namingErrors}
      />

      <SubtitlePruningSection
        state={subtitles}
        maxTracks={form.draft.maxTracks}
        onMaxTracksChange={(value) => form.set('maxTracks', value)}
        maxTracksError={maxTracksError}
      />

      <PlaybackSection state={playback} />

      <SaveBar
        dirty={form.dirty}
        saving={form.saving}
        error={form.error}
        onSave={() => void save()}
        onDiscard={discard}
      />

      <TmdbKeyDialog
        open={tmdbOpen}
        onOpenChange={setTmdbOpen}
        isSet={Boolean(settings?.hasTmdbApiKey)}
        onSave={async (key) => {
          await library.saveSettings({ tmdbApiKey: key })
          toast.success('TMDB key saved. Movies and TV shows can be switched on.')
        }}
      />

      <RootFolderSheet
        mediaType={folderType}
        folder={editingFolder}
        onOpenChange={(open) => {
          if (!open) setFolderType(null)
        }}
        onSaved={() => {
          toast.success('Folder saved')
          void library.reload('rootFolders')
        }}
      />
    </SettingsPage>
  )
}
