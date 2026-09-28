import { useCallback, useEffect, useRef, useState } from 'react'
import { getJson, send } from '@/components/system/system_api'
import {
  normalizeSettings,
  type AppSettings,
  type AppSettingsPatch,
  type MediaType,
  type NamingPatternsData,
  type QualityProfile,
  type RootFolder,
} from '@/components/library-settings/library_catalog'

/** One fetched thing: its data once loaded, or why it could not be. */
export interface LibraryResource<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export type LibraryResourceKey = 'settings' | 'rootFolders' | 'naming' | 'qualityProfiles'

type Needs = Partial<Record<LibraryResourceKey, boolean>>

interface ResourceTypes {
  settings: AppSettings
  rootFolders: RootFolder[]
  naming: NamingPatternsData
  qualityProfiles: QualityProfile[]
}

const SOURCES: Record<
  LibraryResourceKey,
  { url: string; noun: string; parse: (data: any) => ResourceTypes[LibraryResourceKey] }
> = {
  settings: { url: '/api/v1/settings', noun: 'Settings', parse: normalizeSettings },
  rootFolders: {
    url: '/api/v1/rootfolders',
    noun: 'Root folders',
    parse: (data) => (Array.isArray(data) ? data : []),
  },
  naming: {
    url: '/api/v1/settings/naming-patterns',
    noun: 'Naming patterns',
    parse: (data) => data,
  },
  qualityProfiles: {
    url: '/api/v1/qualityprofiles',
    noun: 'Quality profiles',
    parse: (data) => (Array.isArray(data) ? data : []),
  },
}

function initial<T>(needed: boolean | undefined): LibraryResource<T> {
  return { data: null, error: null, loading: Boolean(needed) }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster did not answer.'
}

/**
 * The library configuration Settings → Media, Quality and Discovery share:
 * app settings, root folders, naming patterns and quality profiles. Each page
 * asks only for what it shows, and each fetch fails on its own, so a broken
 * naming endpoint never blanks the media types.
 *
 * Writes go through `saveSettings`, which sends only the keys it is given. The
 * server stores each key separately, so a page never overwrites another page's
 * fields with a stale copy.
 */
export function useLibrarySettings(needs: Needs) {
  const [settings, setSettings] = useState(() => initial<AppSettings>(needs.settings))
  const [rootFolders, setRootFolders] = useState(() => initial<RootFolder[]>(needs.rootFolders))
  const [naming, setNaming] = useState(() => initial<NamingPatternsData>(needs.naming))
  const [qualityProfiles, setQualityProfiles] = useState(() =>
    initial<QualityProfile[]>(needs.qualityProfiles)
  )
  const mounted = useRef(true)
  const needsRef = useRef(needs)
  /** Only the newest settings write may replace the page's copy. */
  const settingsWrite = useRef(0)
  const settingsRef = useRef<AppSettings | null>(null)
  settingsRef.current = settings.data

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const setters = {
    settings: setSettings,
    rootFolders: setRootFolders,
    naming: setNaming,
    qualityProfiles: setQualityProfiles,
  } as Record<
    LibraryResourceKey,
    (update: (r: LibraryResource<any>) => LibraryResource<any>) => void
  >

  const settersRef = useRef(setters)
  settersRef.current = setters

  /** Fetch one resource (again). Keeps what is showing while it reloads. */
  const reload = useCallback(async (key: LibraryResourceKey) => {
    const set = settersRef.current[key]
    const source = SOURCES[key]
    set((current) => ({ ...current, loading: current.data === null, error: null }))
    const writesBefore = settingsWrite.current
    try {
      const data = source.parse(await getJson<unknown>(source.url))
      // A settings write that started meanwhile answers with fresher data.
      if (key === 'settings' && settingsWrite.current !== writesBefore) return
      if (mounted.current) set(() => ({ data, error: null, loading: false }))
    } catch (error) {
      if (mounted.current) {
        set((current) => ({
          ...current,
          loading: false,
          error: `${source.noun} could not be loaded: ${message(error)}`,
        }))
      }
    }
  }, [])

  useEffect(() => {
    const wanted = needsRef.current
    for (const key of Object.keys(SOURCES) as LibraryResourceKey[]) {
      if (wanted[key]) void reload(key)
    }
  }, [reload])

  /** Replace loaded data locally, after a write the caller made itself. */
  const update = useCallback(
    <K extends LibraryResourceKey>(
      key: K,
      updater: (data: ResourceTypes[K]) => ResourceTypes[K]
    ) => {
      settersRef.current[key]((current) =>
        current.data === null ? current : { ...current, data: updater(current.data) }
      )
    },
    []
  )

  /**
   * PUT only these keys to /api/v1/settings. Resolves with the stored settings;
   * rejects with the server's words so a row can show them.
   */
  const saveSettings = useCallback(
    async (patch: AppSettingsPatch): Promise<AppSettings> => {
      const write = ++settingsWrite.current
      let stored: AppSettings
      try {
        stored = normalizeSettings(await send<AppSettings>('/api/v1/settings', 'PUT', patch))
      } catch (error) {
        // An earlier write's answer may have been skipped in favour of this one.
        // Re-read, so every control reverts to what is really stored.
        if (write === settingsWrite.current) void reload('settings')
        throw error
      }
      // A slower, older write must not paint over a newer one.
      if (mounted.current && write === settingsWrite.current) {
        setSettings({ data: stored, error: null, loading: false })
      }
      return stored
    },
    [reload]
  )

  /** Switch a media type on or off. Rejects with the server's words. */
  const setMediaTypeEnabled = useCallback(async (mediaType: MediaType, enabled: boolean) => {
    const result = await send<{ enabledMediaTypes: MediaType[] }>(
      '/api/v1/settings/media-type',
      'POST',
      { mediaType, enabled }
    )
    const enabledMediaTypes = result?.enabledMediaTypes
    if (!Array.isArray(enabledMediaTypes)) return
    if (mounted.current) {
      setSettings((current) =>
        current.data
          ? {
              ...current,
              data: normalizeSettings({ ...current.data, enabledMediaTypes }),
            }
          : current
      )
    }
  }, [])

  /** The newest settings, for composing a write from inside a callback. */
  const latestSettings = useCallback(() => settingsRef.current, [])

  return {
    settings,
    rootFolders,
    naming,
    qualityProfiles,
    reload,
    update,
    saveSettings,
    setMediaTypeEnabled,
    latestSettings,
  }
}
