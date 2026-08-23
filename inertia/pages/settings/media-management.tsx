import { Head } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { CollapsibleRoot, CollapsibleTrigger, CollapsiblePanel } from '@/components/ui/accordion'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Folder01Icon,
  Add01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  MusicNote01Icon,
  Video01Icon,
  Tv01Icon,
  Book01Icon,
  Edit01Icon,
  Key01Icon,
  EyeIcon,
  ViewOffIcon,
  Delete02Icon,
  Globe02Icon,
  StarIcon,
  Refresh01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { FolderBrowser } from '@/components/folder-browser'
import { cn } from '@/lib/utils'

/**
 * One configuration row inside a settings card. Rows bleed to the card edge and
 * are separated by a hairline seam rather than nested in their own boxes.
 */
function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon?: any
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        {icon && (
          <HugeiconsIcon
            icon={icon}
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
          />
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{children}</div>
      )}
    </div>
  )
}

/** Credential presence, carrying an icon and a word as well as a fill. */
function CredentialBadge({ present, noun }: { present: boolean; noun: string }) {
  return present ? (
    <Badge className="border-transparent bg-status-complete text-white">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} />
      {noun} set
    </Badge>
  ) : (
    <Badge className="border-transparent bg-status-queued text-white">
      <HugeiconsIcon icon={Alert02Icon} />
      {noun} missing
    </Badge>
  )
}

type MediaType = 'music' | 'movies' | 'tv' | 'books'

interface RootFolder {
  id: number
  path: string
  name: string
  mediaType: MediaType
  accessible: boolean
  freeSpace: number | null
  totalSpace: number | null
}

interface RecommendationSettings {
  traktEnabled: boolean
  personalizedEnabled: boolean
  maxPersonalizedLanes: number
  justwatchEnabled: boolean
}

interface StreamingProvider {
  id: number
  name: string
  logoPath: string
}

interface AppSettings {
  enabledMediaTypes: MediaType[]
  hasTmdbApiKey: boolean
  hasTraktClientId: boolean
  recommendationSettings: RecommendationSettings
  justwatchEnabled: boolean
  justwatchLocale: string
  selectedStreamingProviders: number[]
}

const mediaTypeInfo: Record<
  MediaType,
  { label: string; icon: any; description: string; needsApiKey?: boolean }
> = {
  movies: {
    label: 'Movies',
    icon: Video01Icon,
    description: 'Movie collection with TMDB metadata',
    needsApiKey: true,
  },
  tv: {
    label: 'TV Shows',
    icon: Tv01Icon,
    description: 'Series with seasons and episodes from TMDB',
    needsApiKey: true,
  },
  music: {
    label: 'Music',
    icon: MusicNote01Icon,
    description: 'Artist and album organization with MusicBrainz metadata',
  },
  books: {
    label: 'Books',
    icon: Book01Icon,
    description: 'Ebook library with OpenLibrary metadata',
  },
}

const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  en_US: 'United States',
  en_GB: 'United Kingdom',
  en_CA: 'Canada',
  en_AU: 'Australia',
  en_IN: 'India',
  de_DE: 'Germany',
  de_AT: 'Austria',
  de_CH: 'Switzerland',
  fr_FR: 'France',
  fr_BE: 'Belgium',
  es_ES: 'Spain',
  es_MX: 'Mexico',
  es_AR: 'Argentina',
  it_IT: 'Italy',
  nl_NL: 'Netherlands',
  pt_BR: 'Brazil',
  pt_PT: 'Portugal',
  sv_SE: 'Sweden',
  da_DK: 'Denmark',
  nb_NO: 'Norway',
  fi_FI: 'Finland',
  pl_PL: 'Poland',
  cs_CZ: 'Czech Republic',
  hu_HU: 'Hungary',
  ro_RO: 'Romania',
  el_GR: 'Greece',
  tr_TR: 'Turkey',
  ja_JP: 'Japan',
  ko_KR: 'South Korea',
  zh_TW: 'Taiwan',
  zh_HK: 'Hong Kong',
  th_TH: 'Thailand',
  en_NZ: 'New Zealand',
  en_ZA: 'South Africa',
}

interface TemplateVariable {
  name: string
  description: string
  example: string
}

interface NamingPatternsData {
  patterns: Record<MediaType, Record<string, string>>
  variables: Record<MediaType, Record<string, TemplateVariable[]>>
  examples: Record<MediaType, Record<string, string>>
}

// Field labels for display
const fieldLabels: Record<string, string> = {
  artistFolder: 'Artist Folder Format',
  albumFolder: 'Album Folder Format',
  trackFile: 'Track File Format',
  movieFolder: 'Movie Folder Format',
  movieFile: 'Movie File Format',
  showFolder: 'Show Folder Format',
  seasonFolder: 'Season Folder Format',
  episodeFile: 'Episode File Format',
  authorFolder: 'Author Folder Format',
  bookFile: 'Book File Format',
}

// Quality profile interfaces and constants
interface QualityItem {
  id: number
  name: string
  allowed: boolean
}

interface QualityProfile {
  id: number
  name: string
  mediaType: MediaType
  cutoff: number
  upgradeAllowed: boolean
  minSizeMb: number | null
  maxSizeMb: number | null
  items: QualityItem[]
}

// Quality options per media type
const QUALITY_OPTIONS: Record<MediaType, { id: number; name: string }[]> = {
  movies: [
    { id: 1, name: 'Bluray 2160p' },
    { id: 2, name: 'Bluray 1080p' },
    { id: 3, name: 'Bluray 720p' },
    { id: 4, name: 'Web 2160p' },
    { id: 5, name: 'Web 1080p' },
    { id: 6, name: 'Web 720p' },
    { id: 7, name: 'HDTV 1080p' },
    { id: 8, name: 'HDTV 720p' },
    { id: 9, name: 'DVD' },
  ],
  tv: [
    { id: 1, name: 'Bluray 2160p' },
    { id: 2, name: 'Bluray 1080p' },
    { id: 3, name: 'Bluray 720p' },
    { id: 4, name: 'Web 2160p' },
    { id: 5, name: 'Web 1080p' },
    { id: 6, name: 'Web 720p' },
    { id: 7, name: 'HDTV 1080p' },
    { id: 8, name: 'HDTV 720p' },
    { id: 9, name: 'DVD' },
  ],
  music: [
    { id: 1, name: 'FLAC' },
    { id: 2, name: 'ALAC' },
    { id: 3, name: 'WAV' },
    { id: 4, name: 'MP3 320' },
    { id: 5, name: 'MP3 V0' },
    { id: 6, name: 'MP3 256' },
    { id: 7, name: 'MP3 192' },
    { id: 8, name: 'AAC 256' },
    { id: 9, name: 'OGG Vorbis' },
  ],
  books: [
    { id: 1, name: 'EPUB' },
    { id: 2, name: 'PDF' },
    { id: 3, name: 'MOBI' },
    { id: 4, name: 'AZW3' },
    { id: 5, name: 'CBZ' },
    { id: 6, name: 'CBR' },
  ],
}

export default function MediaManagement() {
  const [settings, setSettings] = useState<AppSettings>({
    enabledMediaTypes: ['movies'],
    hasTmdbApiKey: false,
    hasTraktClientId: false,
    recommendationSettings: {
      traktEnabled: false,
      personalizedEnabled: false,
      maxPersonalizedLanes: 3,
      justwatchEnabled: false,
    },
    justwatchEnabled: false,
    justwatchLocale: 'en_US',
    selectedStreamingProviders: [],
  })
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [scanningFolderIds, setScanningFolderIds] = useState<Set<number>>(new Set())

  // Streaming providers state
  const [availableProviders, setAvailableProviders] = useState<StreamingProvider[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)

  // Naming patterns state
  const [namingData, setNamingData] = useState<NamingPatternsData | null>(null)
  const [editedPatterns, setEditedPatterns] = useState<Record<MediaType, Record<string, string>>>(
    {} as any
  )
  const [savingPatterns, setSavingPatterns] = useState<Record<MediaType, boolean>>({} as any)

  // Folder dialog state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [editingMediaType, setEditingMediaType] = useState<MediaType>('music')
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null)
  const [newPath, setNewPath] = useState('')
  const [newName, setNewName] = useState('')
  const [createIfMissing, setCreateIfMissing] = useState(false)
  const [saving, setSaving] = useState(false)

  // API Key dialog state
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [tmdbApiKey, setTmdbApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingApiKey, setSavingApiKey] = useState(false)

  // Trakt Client ID dialog state
  const [traktDialogOpen, setTraktDialogOpen] = useState(false)
  const [traktClientId, setTraktClientId] = useState('')
  const [showTraktKey, setShowTraktKey] = useState(false)
  const [savingTraktKey, setSavingTraktKey] = useState(false)

  // Quality profile state
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([])
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false)
  const [editingQuality, setEditingQuality] = useState<QualityProfile | null>(null)
  const [qualityMediaType, setQualityMediaType] = useState<MediaType>('music')
  const [qualityName, setQualityName] = useState('')
  const [qualityItems, setQualityItems] = useState<QualityItem[]>([])
  const [qualityUpgradeAllowed, setQualityUpgradeAllowed] = useState(true)
  const [qualityMinSize, setQualityMinSize] = useState('')
  const [qualityMaxSize, setQualityMaxSize] = useState('')
  const [savingQuality, setSavingQuality] = useState(false)

  // Streaming provider selection panel state
  const [showProviderSelection, setShowProviderSelection] = useState(false)
  const [providerSearch, setProviderSearch] = useState('')

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProfile, setDeletingProfile] = useState<QualityProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = async () => {
    try {
      const [settingsRes, foldersRes, namingRes, qualityRes] = await Promise.all([
        fetch('/api/v1/settings'),
        fetch('/api/v1/rootfolders'),
        fetch('/api/v1/settings/naming-patterns'),
        fetch('/api/v1/qualityprofiles'),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings((prev) => ({
          ...prev,
          ...data,
          recommendationSettings: data.recommendationSettings ?? prev.recommendationSettings,
        }))
      }
      if (foldersRes.ok) {
        const data = await foldersRes.json()
        setRootFolders(data)
      }
      if (namingRes.ok) {
        const data = await namingRes.json()
        setNamingData(data)
        // Initialize edited patterns with current values
        setEditedPatterns(JSON.parse(JSON.stringify(data.patterns)))
      }
      if (qualityRes.ok) {
        const data = await qualityRes.json()
        setQualityProfiles(data)
      }
    } catch (error) {
      toast.error(
        'Settings could not be loaded — Hamster is unreachable. Reload the page to retry.'
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchProviders = async () => {
    setLoadingProviders(true)
    try {
      const res = await fetch('/api/v1/settings/watch-providers')
      if (res.ok) {
        const data = await res.json()
        setAvailableProviders(data.providers || [])
      }
    } catch {
      // Silently fail - providers are optional
    } finally {
      setLoadingProviders(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Fetch providers when TMDB key is available
  useEffect(() => {
    if (settings.hasTmdbApiKey) {
      fetchProviders()
    }
  }, [settings.hasTmdbApiKey])

  const handleToggleStreamingProvider = async (providerId: number) => {
    const current = settings.selectedStreamingProviders
    const updated = current.includes(providerId)
      ? current.filter((id) => id !== providerId)
      : [...current, providerId]

    setSettings((prev) => ({ ...prev, selectedStreamingProviders: updated }))
    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedStreamingProviders: updated }),
      })
      if (!response.ok) {
        toast.error(
          'Streaming services not saved — the server rejected the change. Your previous selection is restored.'
        )
        fetchData()
      }
    } catch {
      toast.error(
        'Streaming services not saved — Hamster is unreachable. Your previous selection is restored.'
      )
      fetchData()
    }
  }

  const handleToggleMediaType = async (mediaType: MediaType, enabled: boolean) => {
    // Check if TMDB API key is needed
    if (enabled && mediaTypeInfo[mediaType].needsApiKey && !settings.hasTmdbApiKey) {
      toast.error(
        `${mediaTypeInfo[mediaType].label} need TMDB metadata. Add a TMDB API key first — the dialog is open.`
      )
      setApiKeyDialogOpen(true)
      return
    }

    try {
      const response = await fetch('/api/v1/settings/media-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaType, enabled }),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings((prev) => ({ ...prev, enabledMediaTypes: data.enabledMediaTypes }))
        toast.success(`${mediaTypeInfo[mediaType].label} ${enabled ? 'enabled' : 'disabled'}`)
      } else {
        toast.error(
          `${mediaTypeInfo[mediaType].label} could not be turned ${enabled ? 'on' : 'off'} — the server rejected the change.`
        )
      }
    } catch (error) {
      toast.error(
        `${mediaTypeInfo[mediaType].label} could not be turned ${enabled ? 'on' : 'off'} — Hamster is unreachable. Try again.`
      )
    }
  }

  const getFolderForMediaType = (mediaType: MediaType) => {
    return rootFolders.find((folder) => folder.mediaType === mediaType)
  }

  const handleRescan = async (folderId: number) => {
    // Optimistically mark as scanning. The scan endpoint returns 202
    // immediately and the work continues in the background, so we poll
    // /scan-status until it reports isScanning=false before clearing.
    setScanningFolderIds((prev) => {
      const next = new Set(prev)
      next.add(folderId)
      return next
    })

    try {
      const response = await fetch(`/api/v1/rootfolders/${folderId}/scan`, { method: 'POST' })

      if (response.status === 409) {
        toast.info('A scan is already running for this folder. Wait for it to finish.')
      } else if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error(
          data.error ||
            'Scan did not start — the server rejected the request. Check the folder is readable.'
        )
        setScanningFolderIds((prev) => {
          const next = new Set(prev)
          next.delete(folderId)
          return next
        })
        return
      } else {
        toast.success('Library scan started')
      }
    } catch {
      toast.error('Scan did not start — Hamster is unreachable. Try again.')
      setScanningFolderIds((prev) => {
        const next = new Set(prev)
        next.delete(folderId)
        return next
      })
      return
    }

    // Poll status every 3s. Stop when isScanning is false or after 15 min
    // (safety cap — large libraries can take a while but the polling
    // shouldn't outlive a reasonable scan).
    const startedAt = Date.now()
    const POLL_INTERVAL_MS = 3000
    const POLL_TIMEOUT_MS = 15 * 60 * 1000

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/rootfolders/${folderId}/scan-status`)
        if (!res.ok) throw new Error('status check failed')
        const data = await res.json()
        if (!data.isScanning) {
          setScanningFolderIds((prev) => {
            const next = new Set(prev)
            next.delete(folderId)
            return next
          })
          toast.success('Library scan complete')
          fetchData()
          return
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setScanningFolderIds((prev) => {
            const next = new Set(prev)
            next.delete(folderId)
            return next
          })
          return
        }
        setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        setScanningFolderIds((prev) => {
          const next = new Set(prev)
          next.delete(folderId)
          return next
        })
      }
    }
    setTimeout(poll, POLL_INTERVAL_MS)
  }

  const openFolderDialog = (mediaType: MediaType) => {
    const existingFolder = getFolderForMediaType(mediaType)
    setEditingMediaType(mediaType)
    setEditingFolderId(existingFolder?.id || null)
    setNewPath(existingFolder?.path || '')
    setNewName(existingFolder?.name || '')
    setCreateIfMissing(false)
    setFolderDialogOpen(true)
  }

  const handleSaveFolder = async () => {
    if (!newPath.trim()) {
      toast.error('Pick a folder before saving — the library needs somewhere to look.')
      return
    }

    setSaving(true)
    try {
      if (editingFolderId) {
        // Update existing folder
        const response = await fetch(`/api/v1/rootfolders/${editingFolderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: newPath,
            name: newName || undefined,
            mediaType: editingMediaType,
          }),
        })

        if (response.ok) {
          toast.success('Folder updated')
          setFolderDialogOpen(false)
          fetchData()
        } else {
          const error = await response.json()
          toast.error(
            error.error ||
              'Folder not updated — the server rejected the path. Check it exists and Hamster can read it.'
          )
        }
      } else {
        // Create new folder
        const response = await fetch('/api/v1/rootfolders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: newPath,
            name: newName || undefined,
            mediaType: editingMediaType,
            createIfMissing,
          }),
        })

        if (response.ok) {
          toast.success('Folder added')
          setFolderDialogOpen(false)
          fetchData()
        } else {
          const error = await response.json()
          toast.error(
            error.error ||
              'Folder not added — the server rejected the path. Check it exists and Hamster can read it.'
          )
        }
      }
    } catch (error) {
      toast.error('Folder not saved — Hamster is unreachable. Check the server and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveApiKey = async () => {
    if (!tmdbApiKey.trim()) {
      toast.error('Paste the TMDB v3 API key before saving.')
      return
    }

    setSavingApiKey(true)
    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbApiKey }),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings((prev) => ({ ...prev, hasTmdbApiKey: data.hasTmdbApiKey }))
        toast.success('TMDB API key saved')
        setApiKeyDialogOpen(false)
        setTmdbApiKey('')
      } else {
        toast.error('TMDB key not saved — the server rejected it. Check you copied the v3 key.')
      }
    } catch (error) {
      toast.error('TMDB key not saved — Hamster is unreachable. Check the server and try again.')
    } finally {
      setSavingApiKey(false)
    }
  }

  const handleSaveTraktKey = async () => {
    if (!traktClientId.trim()) {
      toast.error('Paste the Trakt client ID before saving.')
      return
    }

    setSavingTraktKey(true)
    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traktClientId }),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings((prev) => ({ ...prev, hasTraktClientId: data.hasTraktClientId }))
        toast.success('Trakt client ID saved')
        setTraktDialogOpen(false)
        setTraktClientId('')
      } else {
        toast.error(
          'Trakt client ID not saved — the server rejected it. Check you copied it in full.'
        )
      }
    } catch (error) {
      toast.error(
        'Trakt client ID not saved — Hamster is unreachable. Check the server and try again.'
      )
    } finally {
      setSavingTraktKey(false)
    }
  }

  const handleSaveRecommendationSettings = async (updated: RecommendationSettings) => {
    setSettings((prev) => ({ ...prev, recommendationSettings: updated }))
    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationSettings: updated }),
      })

      if (!response.ok) {
        toast.error(
          'Recommendation settings not saved — the server rejected the change. The old values are restored.'
        )
        fetchData()
      }
    } catch (error) {
      toast.error(
        'Recommendation settings not saved — Hamster is unreachable. The old values are restored.'
      )
      fetchData()
    }
  }

  const handleJustWatchToggle = async (enabled: boolean) => {
    const updatedRecSettings = { ...settings.recommendationSettings, justwatchEnabled: enabled }
    setSettings((prev) => ({
      ...prev,
      justwatchEnabled: enabled,
      recommendationSettings: updatedRecSettings,
    }))
    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justwatchEnabled: enabled,
          recommendationSettings: updatedRecSettings,
        }),
      })
      if (!response.ok) {
        toast.error(
          'JustWatch setting not saved — the server rejected the change. The old value is restored.'
        )
        fetchData()
      }
    } catch {
      toast.error(
        'JustWatch setting not saved — Hamster is unreachable. The old value is restored.'
      )
      fetchData()
    }
  }

  const handleJustWatchLocaleChange = async (locale: string) => {
    setSettings((prev) => ({ ...prev, justwatchLocale: locale }))
    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justwatchLocale: locale }),
      })
      if (!response.ok) {
        toast.error(
          'Region not saved — the server rejected the change. The old region is restored.'
        )
        fetchData()
      }
    } catch {
      toast.error('Region not saved — Hamster is unreachable. The old region is restored.')
      fetchData()
    }
  }

  const handlePatternChange = (mediaType: MediaType, field: string, value: string) => {
    setEditedPatterns((prev) => ({
      ...prev,
      [mediaType]: {
        ...prev[mediaType],
        [field]: value,
      },
    }))
  }

  const hasPatternChanges = (mediaType: MediaType): boolean => {
    if (!namingData || !editedPatterns[mediaType]) return false
    const original = namingData.patterns[mediaType]
    const edited = editedPatterns[mediaType]
    return Object.keys(original).some((key) => original[key] !== edited[key])
  }

  const handleSavePatterns = async (mediaType: MediaType) => {
    if (!editedPatterns[mediaType]) return

    setSavingPatterns((prev) => ({ ...prev, [mediaType]: true }))
    try {
      const response = await fetch('/api/v1/settings/naming-patterns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType,
          patterns: editedPatterns[mediaType],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update namingData with new patterns and examples
        setNamingData((prev) =>
          prev
            ? {
                ...prev,
                patterns: {
                  ...prev.patterns,
                  [mediaType]: data.patterns,
                },
                examples: {
                  ...prev.examples,
                  [mediaType]: data.examples,
                },
              }
            : null
        )
        toast.success(`${mediaTypeInfo[mediaType].label} naming patterns saved`)
      } else {
        const error = await response.json()
        toast.error(
          error.error ||
            'Naming patterns not saved — the server rejected them. Check every {variable} is spelled as listed.'
        )
      }
    } catch (error) {
      toast.error('Naming patterns not saved — Hamster is unreachable. Try again.')
    } finally {
      setSavingPatterns((prev) => ({ ...prev, [mediaType]: false }))
    }
  }

  const getExampleForPattern = (mediaType: MediaType, field: string, pattern: string): string => {
    // Generate a simple client-side example based on the pattern
    if (!namingData) return ''
    const vars = namingData.variables[mediaType]?.[field] || []
    let result = pattern
    for (const v of vars) {
      result = result.replace(new RegExp(`\\{${v.name}\\}`, 'g'), v.example)
    }
    return result
      .replace(/\s*\(\s*\)/g, '')
      .replace(/\s*\[\s*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Quality profile functions
  const openQualityDialog = (mediaType: MediaType, profile?: QualityProfile) => {
    setQualityMediaType(mediaType)
    if (profile) {
      setEditingQuality(profile)
      setQualityName(profile.name)
      setQualityItems(profile.items)
      setQualityUpgradeAllowed(profile.upgradeAllowed)
      setQualityMinSize(profile.minSizeMb != null ? String(profile.minSizeMb) : '')
      setQualityMaxSize(profile.maxSizeMb != null ? String(profile.maxSizeMb) : '')
    } else {
      setEditingQuality(null)
      setQualityName('')
      // Initialize with all items enabled
      setQualityItems(QUALITY_OPTIONS[mediaType].map((q) => ({ ...q, allowed: true })))
      setQualityUpgradeAllowed(true)
      setQualityMinSize('')
      setQualityMaxSize('')
    }
    setQualityDialogOpen(true)
  }

  const handleSaveQuality = async () => {
    if (!qualityName.trim()) {
      toast.error('Give the profile a name so you can pick it later.')
      return
    }

    setSavingQuality(true)
    try {
      const url = editingQuality
        ? `/api/v1/qualityprofiles/${editingQuality.id}`
        : '/api/v1/qualityprofiles'

      const response = await fetch(url, {
        method: editingQuality ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: qualityName,
          mediaType: qualityMediaType,
          items: qualityItems,
          upgradeAllowed: qualityUpgradeAllowed,
          minSizeMb: qualityMinSize ? Number(qualityMinSize) : undefined,
          maxSizeMb: qualityMaxSize ? Number(qualityMaxSize) : undefined,
          cutoff: qualityItems.find((i) => i.allowed)?.id || 1,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (editingQuality) {
          setQualityProfiles((prev) => prev.map((p) => (p.id === data.id ? data : p)))
        } else {
          setQualityProfiles((prev) => [...prev, data])
        }
        toast.success(`Quality profile ${editingQuality ? 'updated' : 'created'}`)
        setQualityDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(
          error.error ||
            'Quality profile not saved — the server rejected it. Check at least one quality is allowed.'
        )
      }
    } catch (error) {
      toast.error('Quality profile not saved — Hamster is unreachable. Try again.')
    } finally {
      setSavingQuality(false)
    }
  }

  const openDeleteDialog = (profile: QualityProfile) => {
    setDeletingProfile(profile)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingProfile) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/qualityprofiles/${deletingProfile.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setQualityProfiles((prev) => prev.filter((p) => p.id !== deletingProfile.id))
        toast.success('Quality profile deleted')
        setDeleteDialogOpen(false)
        setDeletingProfile(null)
      } else {
        toast.error(
          'Quality profile not deleted — the server refused. It may still be in use by a title.'
        )
      }
    } catch (error) {
      toast.error('Quality profile not deleted — Hamster is unreachable. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  const toggleQualityItem = (itemId: number) => {
    setQualityItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, allowed: !item.allowed } : item))
    )
  }

  const getProfilesForMediaType = (mediaType: MediaType) => {
    return qualityProfiles.filter((p) => p.mediaType === mediaType)
  }

  // Enabled types in the canonical order, so the cards below stay in step with
  // the Media types card rather than following server response order.
  const enabledTypes = (Object.keys(mediaTypeInfo) as MediaType[]).filter((mediaType) =>
    settings.enabledMediaTypes.includes(mediaType)
  )

  return (
    <AppLayout title="Media Management">
      <Head title="Media Management" />

      <div className="space-y-6">
        {/* Metadata providers */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata providers</CardTitle>
            <CardDescription>
              Where titles, artwork and release dates come from. Movies and TV need a TMDB key;
              music and books use MusicBrainz and OpenLibrary, which need none.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border border-y border-border">
              <SettingRow
                icon={Key01Icon}
                title="TMDB API key"
                description={
                  <>
                    Required before Movies or TV Shows can be enabled.{' '}
                    <a
                      href="https://www.themoviedb.org/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Get one free
                    </a>
                  </>
                }
              >
                <CredentialBadge present={settings.hasTmdbApiKey} noun="Key" />
                <Button variant="outline" size="sm" onClick={() => setApiKeyDialogOpen(true)}>
                  {settings.hasTmdbApiKey ? 'Replace key' : 'Add key'}
                </Button>
              </SettingRow>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Discovery sources</CardTitle>
            <CardDescription>
              What fills the lanes on the Search page. Each source is independent — turning one off
              leaves the others running.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border border-y border-border">
              <SettingRow
                icon={Globe02Icon}
                title="Trakt.tv"
                description={
                  <>
                    Community trending, anticipated and recommended lists. Needs its own client ID.{' '}
                    <a
                      href="https://trakt.tv/oauth/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Get one free
                    </a>
                  </>
                }
              >
                <CredentialBadge present={settings.hasTraktClientId} noun="Client ID" />
                <Switch
                  checked={settings.recommendationSettings.traktEnabled}
                  aria-label="Show Trakt lanes"
                  onCheckedChange={(checked) =>
                    handleSaveRecommendationSettings({
                      ...settings.recommendationSettings,
                      traktEnabled: checked,
                    })
                  }
                  disabled={!settings.hasTraktClientId}
                />
                <Button variant="outline" size="sm" onClick={() => setTraktDialogOpen(true)}>
                  {settings.hasTraktClientId ? 'Replace ID' : 'Set client ID'}
                </Button>
              </SettingRow>

              <SettingRow
                icon={Tv01Icon}
                title="JustWatch"
                description="Streaming availability badges and a lane of what is popular on the services you subscribe to."
              >
                {settings.justwatchEnabled && (
                  <Select
                    value={settings.justwatchLocale}
                    onValueChange={(value) => handleJustWatchLocaleChange(value)}
                  >
                    <SelectTrigger className="w-36" aria-label="JustWatch region">
                      <span className="truncate">
                        {LOCALE_DISPLAY_NAMES[settings.justwatchLocale] || settings.justwatchLocale}
                      </span>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="en_US">United States</SelectItem>
                      <SelectItem value="en_GB">United Kingdom</SelectItem>
                      <SelectItem value="en_CA">Canada</SelectItem>
                      <SelectItem value="en_AU">Australia</SelectItem>
                      <SelectItem value="en_IN">India</SelectItem>
                      <SelectItem value="de_DE">Germany</SelectItem>
                      <SelectItem value="de_AT">Austria</SelectItem>
                      <SelectItem value="de_CH">Switzerland</SelectItem>
                      <SelectItem value="fr_FR">France</SelectItem>
                      <SelectItem value="fr_BE">Belgium</SelectItem>
                      <SelectItem value="es_ES">Spain</SelectItem>
                      <SelectItem value="es_MX">Mexico</SelectItem>
                      <SelectItem value="es_AR">Argentina</SelectItem>
                      <SelectItem value="it_IT">Italy</SelectItem>
                      <SelectItem value="nl_NL">Netherlands</SelectItem>
                      <SelectItem value="pt_BR">Brazil</SelectItem>
                      <SelectItem value="pt_PT">Portugal</SelectItem>
                      <SelectItem value="sv_SE">Sweden</SelectItem>
                      <SelectItem value="da_DK">Denmark</SelectItem>
                      <SelectItem value="nb_NO">Norway</SelectItem>
                      <SelectItem value="fi_FI">Finland</SelectItem>
                      <SelectItem value="pl_PL">Poland</SelectItem>
                      <SelectItem value="cs_CZ">Czech Republic</SelectItem>
                      <SelectItem value="hu_HU">Hungary</SelectItem>
                      <SelectItem value="ro_RO">Romania</SelectItem>
                      <SelectItem value="el_GR">Greece</SelectItem>
                      <SelectItem value="tr_TR">Turkey</SelectItem>
                      <SelectItem value="ja_JP">Japan</SelectItem>
                      <SelectItem value="ko_KR">South Korea</SelectItem>
                      <SelectItem value="zh_TW">Taiwan</SelectItem>
                      <SelectItem value="zh_HK">Hong Kong</SelectItem>
                      <SelectItem value="th_TH">Thailand</SelectItem>
                      <SelectItem value="en_NZ">New Zealand</SelectItem>
                      <SelectItem value="en_ZA">South Africa</SelectItem>
                    </SelectPopup>
                  </Select>
                )}
                <Switch
                  checked={settings.justwatchEnabled}
                  aria-label="Show JustWatch availability"
                  onCheckedChange={handleJustWatchToggle}
                />
              </SettingRow>

              <SettingRow
                icon={StarIcon}
                title="Personalised lanes"
                description={
                  '"Because you have…" lanes built from titles already in your library, using TMDB recommendations.'
                }
              >
                {settings.recommendationSettings.personalizedEnabled && (
                  <Select
                    value={settings.recommendationSettings.maxPersonalizedLanes.toString()}
                    onValueChange={(value) =>
                      handleSaveRecommendationSettings({
                        ...settings.recommendationSettings,
                        maxPersonalizedLanes: Number.parseInt(value, 10),
                      })
                    }
                  >
                    <SelectTrigger className="w-24" aria-label="Maximum personalised lanes">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="1">1 lane</SelectItem>
                      <SelectItem value="2">2 lanes</SelectItem>
                      <SelectItem value="3">3 lanes</SelectItem>
                      <SelectItem value="5">5 lanes</SelectItem>
                    </SelectPopup>
                  </Select>
                )}
                <Switch
                  checked={settings.recommendationSettings.personalizedEnabled}
                  aria-label="Show personalised lanes"
                  onCheckedChange={(checked) =>
                    handleSaveRecommendationSettings({
                      ...settings.recommendationSettings,
                      personalizedEnabled: checked,
                    })
                  }
                />
              </SettingRow>
            </div>
          </CardContent>
        </Card>

        {/* Streaming Services */}
        {settings.hasTmdbApiKey && (
          <Card>
            <CardHeader>
              <CardTitle>Your streaming services</CardTitle>
              <CardDescription>
                Pick the subscriptions you actually hold. Titles already streaming on one of them
                are marked in search results, so you can skip downloading them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProviders ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : availableProviders.length > 0 ? (
                <div className="space-y-4">
                  {/* Selected providers */}
                  {settings.selectedStreamingProviders.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {availableProviders
                        .filter((p) => settings.selectedStreamingProviders.includes(p.id))
                        .map((provider) => (
                          <div
                            key={provider.id}
                            className="flex items-center gap-3 rounded-md border border-primary bg-primary/5 p-3"
                          >
                            <img
                              src={provider.logoPath}
                              alt=""
                              className="size-8 shrink-0 rounded-sm"
                            />
                            <span className="truncate text-sm font-medium">{provider.name}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      None selected, so nothing is marked as already streaming.
                    </p>
                  )}

                  {/* Toggle selection panel */}
                  {!showProviderSelection ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowProviderSelection(true)}
                    >
                      <HugeiconsIcon icon={Add01Icon} />
                      Choose services
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-md border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          <span className="readout">
                            {settings.selectedStreamingProviders.length}
                          </span>{' '}
                          service
                          {settings.selectedStreamingProviders.length !== 1 ? 's' : ''} selected
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowProviderSelection(false)
                            setProviderSearch('')
                          }}
                        >
                          Done
                        </Button>
                      </div>
                      <Input
                        placeholder="Search services…"
                        aria-label="Search streaming services"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                      />
                      <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
                        {availableProviders
                          .filter((p) =>
                            p.name.toLowerCase().includes(providerSearch.toLowerCase())
                          )
                          .map((provider) => {
                            const isSelected = settings.selectedStreamingProviders.includes(
                              provider.id
                            )
                            return (
                              <button
                                key={provider.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => handleToggleStreamingProvider(provider.id)}
                                className={cn(
                                  'flex items-center gap-3 rounded-md border p-3 text-left outline-none transition-colors duration-150',
                                  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                  isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:bg-accent'
                                )}
                              >
                                <img
                                  src={provider.logoPath}
                                  alt=""
                                  className="size-8 shrink-0 rounded-sm"
                                />
                                <span className="truncate text-sm font-medium">
                                  {provider.name}
                                </span>
                                {isSelected && (
                                  <HugeiconsIcon
                                    icon={CheckmarkCircle02Icon}
                                    className="ml-auto size-4 shrink-0 text-primary"
                                  />
                                )}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  TMDB returned no providers for this region. Set a JustWatch region above, then
                  reload the page.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Media types and their root folders */}
        <Card>
          <CardHeader>
            <CardTitle>Media types</CardTitle>
            <CardDescription>
              Which libraries this install manages, and the folder on disk each one owns. A type
              with no folder is enabled but inert — nothing is scanned and nothing can be imported.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border border-y border-border">
              {(Object.keys(mediaTypeInfo) as MediaType[]).map((mediaType) => {
                const info = mediaTypeInfo[mediaType]
                const isEnabled = settings.enabledMediaTypes.includes(mediaType)
                const folder = getFolderForMediaType(mediaType)
                const scanning = folder ? scanningFolderIds.has(folder.id) : false

                return (
                  <div key={mediaType} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <HugeiconsIcon
                          icon={info.icon}
                          className={cn(
                            'mt-0.5 size-5 shrink-0',
                            isEnabled ? 'text-foreground' : 'text-muted-foreground'
                          )}
                          strokeWidth={1.5}
                        />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium">{info.label}</p>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        aria-label={`Manage ${info.label}`}
                        onCheckedChange={(checked) => handleToggleMediaType(mediaType, checked)}
                      />
                    </div>

                    {isEnabled && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
                        <HugeiconsIcon
                          icon={Folder01Icon}
                          className="size-4 shrink-0 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                        {folder ? (
                          <>
                            <code className="readout rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                              {folder.path}
                            </code>
                            {folder.accessible ? (
                              <Badge className="border-transparent bg-status-complete text-white">
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                                Readable
                              </Badge>
                            ) : (
                              <Badge className="border-transparent bg-status-failed text-white">
                                <HugeiconsIcon icon={Alert02Icon} />
                                Unreachable
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Rescan the ${info.label} folder`}
                              title="Rescan this folder to reconcile files on disk with the library"
                              disabled={scanning || !folder.accessible}
                              onClick={() => handleRescan(folder.id)}
                            >
                              <HugeiconsIcon
                                icon={Refresh01Icon}
                                className={cn('size-4', scanning && 'animate-spin')}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Change the ${info.label} folder`}
                              onClick={() => openFolderDialog(mediaType)}
                            >
                              <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                            </Button>
                            {!folder.accessible && (
                              <span className="text-xs text-muted-foreground">
                                Hamster cannot read this path. Check the mount and permissions.
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <Badge className="border-transparent bg-status-queued text-white">
                              <HugeiconsIcon icon={Alert02Icon} />
                              No folder set
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openFolderDialog(mediaType)}
                            >
                              <HugeiconsIcon icon={Add01Icon} />
                              Set folder
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* File organization */}
        <Card>
          <CardHeader>
            <CardTitle>File organization</CardTitle>
            <CardDescription>
              The folder and file names Hamster writes when it imports. Click a variable to append
              it; the example under each field is rendered from the pattern as it stands.
            </CardDescription>
          </CardHeader>
          <CardContent className={enabledTypes.length === 0 ? undefined : 'px-0'}>
            {enabledTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No media type is on yet. Turn one on above and its naming patterns appear here.
              </p>
            ) : (
              <div className="divide-y divide-border border-y border-border">
                {enabledTypes.map((mediaType) => (
                  <CollapsibleRoot key={mediaType} className="px-6 py-4">
                    <CollapsibleTrigger className="text-foreground">
                      {mediaTypeInfo[mediaType].label}
                    </CollapsibleTrigger>
                    <CollapsiblePanel>
                      <div className="space-y-6 pt-4">
                        {namingData &&
                          editedPatterns[mediaType] &&
                          Object.entries(editedPatterns[mediaType]).map(([field, pattern]) => {
                            const variables = namingData.variables[mediaType]?.[field] || []
                            const example = getExampleForPattern(mediaType, field, pattern)
                            return (
                              <div key={field} className="space-y-2">
                                <Label htmlFor={`${mediaType}-${field}`}>
                                  {fieldLabels[field] || field}
                                </Label>
                                <Input
                                  id={`${mediaType}-${field}`}
                                  value={pattern}
                                  onChange={(e) =>
                                    handlePatternChange(mediaType, field, e.target.value)
                                  }
                                  className="readout"
                                />
                                {example && (
                                  <p className="text-xs text-muted-foreground">
                                    Renders as <span className="readout">{example}</span>
                                  </p>
                                )}
                                {variables.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {variables.map((v) => (
                                      <button
                                        key={v.name}
                                        type="button"
                                        onClick={() =>
                                          handlePatternChange(
                                            mediaType,
                                            field,
                                            pattern + `{${v.name}}`
                                          )
                                        }
                                        className="readout rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        title={v.description}
                                      >
                                        {`{${v.name}}`}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        {hasPatternChanges(mediaType) && (
                          <Button
                            size="sm"
                            onClick={() => handleSavePatterns(mediaType)}
                            disabled={savingPatterns[mediaType]}
                          >
                            {savingPatterns[mediaType] ? 'Saving…' : 'Save changes'}
                          </Button>
                        )}
                      </div>
                    </CollapsiblePanel>
                  </CollapsibleRoot>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality profiles */}
        <Card>
          <CardHeader>
            <CardTitle>Quality profiles</CardTitle>
            <CardDescription>
              Which releases Hamster is allowed to accept, and whether it replaces a file it already
              has when something better appears. Every monitored title uses one.
            </CardDescription>
          </CardHeader>
          <CardContent className={enabledTypes.length === 0 ? undefined : 'px-0'}>
            {enabledTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No media type is on yet. Turn one on above, then come back here to say which quality
                levels are acceptable for it.
              </p>
            ) : (
              <div className="divide-y divide-border border-y border-border">
                {enabledTypes.map((mediaType) => {
                  const profiles = getProfilesForMediaType(mediaType)
                  return (
                    <div key={mediaType} className="space-y-3 px-6 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">{mediaTypeInfo[mediaType].label}</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openQualityDialog(mediaType)}
                        >
                          <HugeiconsIcon icon={Add01Icon} />
                          Add profile
                        </Button>
                      </div>
                      {profiles.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No profile yet. Add one to say which releases are acceptable for{' '}
                          {mediaTypeInfo[mediaType].label.toLowerCase()}.
                        </p>
                      ) : (
                        <div className="divide-y divide-border rounded-md border border-border">
                          {profiles.map((profile) => (
                            <div
                              key={profile.id}
                              className="flex items-start justify-between gap-3 p-3"
                            >
                              <div className="min-w-0 space-y-1.5">
                                <p className="text-sm font-medium">{profile.name}</p>
                                <div className="flex flex-wrap gap-1">
                                  {profile.items
                                    .filter((i) => i.allowed)
                                    .map((item) => (
                                      <Badge key={item.id} variant="secondary" className="readout">
                                        {item.name}
                                      </Badge>
                                    ))}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${profile.name}`}
                                  onClick={() => openQualityDialog(mediaType, profile)}
                                >
                                  <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${profile.name}`}
                                  onClick={() => openDeleteDialog(profile)}
                                >
                                  <HugeiconsIcon
                                    icon={Delete02Icon}
                                    className="size-4 text-destructive"
                                  />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFolderId ? 'Edit' : 'Set'} {mediaTypeInfo[editingMediaType].label} Folder
            </DialogTitle>
            <DialogDescription>
              The folder Hamster scans for {mediaTypeInfo[editingMediaType].label.toLowerCase()} and
              writes imports into. Inside Docker this is the container path, not the host path.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <FolderBrowser
              value={newPath}
              onChange={setNewPath}
              createIfMissing={createIfMissing}
              onCreateIfMissingChange={setCreateIfMissing}
            />
            <div className="space-y-2 border-t border-border pt-6">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder={`My ${mediaTypeInfo[editingMediaType].label} Library`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown instead of the raw path where the folder is referred to.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFolder} disabled={saving || !newPath}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TMDB API Key</DialogTitle>
            <DialogDescription>
              Movies and TV Shows cannot be enabled without one. Free, and issued instantly at{' '}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                themoviedb.org
              </a>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key (v3 auth)</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Paste the v3 API key"
                  value={tmdbApiKey}
                  onChange={(e) => setTmdbApiKey(e.target.value)}
                  className="readout pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  <HugeiconsIcon icon={showApiKey ? ViewOffIcon : EyeIcon} className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The v3 key, not the v4 read access token.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKey} disabled={savingApiKey || !tmdbApiKey.trim()}>
              {savingApiKey ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trakt Client ID Dialog */}
      <Dialog open={traktDialogOpen} onOpenChange={setTraktDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trakt Client ID</DialogTitle>
            <DialogDescription>
              Unlocks the Trakt lanes on the Search page. Register an application — any name will do
              — at{' '}
              <a
                href="https://trakt.tv/oauth/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                trakt.tv
              </a>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="traktClientId">Client ID</Label>
              <div className="relative">
                <Input
                  id="traktClientId"
                  type={showTraktKey ? 'text' : 'password'}
                  placeholder="Paste the client ID"
                  value={traktClientId}
                  onChange={(e) => setTraktClientId(e.target.value)}
                  className="readout pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={showTraktKey ? 'Hide client ID' : 'Show client ID'}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowTraktKey(!showTraktKey)}
                >
                  <HugeiconsIcon icon={showTraktKey ? ViewOffIcon : EyeIcon} className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">The client ID, not the client secret.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTraktDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTraktKey} disabled={savingTraktKey || !traktClientId.trim()}>
              {savingTraktKey ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quality Profile Dialog */}
      <Dialog open={qualityDialogOpen} onOpenChange={setQualityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuality ? 'Edit' : 'Add'} Quality Profile</DialogTitle>
            <DialogDescription>
              Which releases Hamster may accept for{' '}
              {mediaTypeInfo[qualityMediaType].label.toLowerCase()}, and the size band it will stay
              inside.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="qualityName">Profile Name</Label>
              <Input
                id="qualityName"
                placeholder="e.g. High Quality"
                value={qualityName}
                onChange={(e) => setQualityName(e.target.value)}
              />
            </div>
            <fieldset className="space-y-3 border-t border-border pt-6">
              <legend className="sr-only">Allowed qualities</legend>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Allowed qualities</h3>
                <p className="text-xs text-muted-foreground">
                  Releases outside this set are skipped. At least one is required.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUALITY_OPTIONS[qualityMediaType].map((option) => {
                  const item = qualityItems.find((i) => i.id === option.id)
                  return (
                    <div key={option.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`quality-${option.id}`}
                        checked={item?.allowed ?? false}
                        onCheckedChange={() => toggleQualityItem(option.id)}
                      />
                      <Label
                        htmlFor={`quality-${option.id}`}
                        className="readout cursor-pointer font-normal"
                      >
                        {option.name}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </fieldset>
            <div className="space-y-3 border-t border-border pt-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Size band</h3>
                <p className="text-xs text-muted-foreground">
                  Optional guard against mislabelled releases. Leave blank for no limit.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qualityMinSize">Min size (MB)</Label>
                  <Input
                    id="qualityMinSize"
                    type="number"
                    min="0"
                    placeholder="No minimum"
                    value={qualityMinSize}
                    onChange={(e) => setQualityMinSize(e.target.value)}
                    className="readout"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualityMaxSize">Max size (MB)</Label>
                  <Input
                    id="qualityMaxSize"
                    type="number"
                    min="0"
                    placeholder="No maximum"
                    value={qualityMaxSize}
                    onChange={(e) => setQualityMaxSize(e.target.value)}
                    className="readout"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="upgradeAllowed"
                checked={qualityUpgradeAllowed}
                onCheckedChange={setQualityUpgradeAllowed}
              />
              <Label htmlFor="upgradeAllowed" className="cursor-pointer font-normal">
                Replace a file already on disk when a better release appears
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuality}
              disabled={
                savingQuality || !qualityName.trim() || !qualityItems.some((i) => i.allowed)
              }
            >
              {savingQuality ? 'Saving…' : editingQuality ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile</DialogTitle>
            <DialogDescription>
              "{deletingProfile?.name}" is removed and can no longer be assigned. Titles already
              using it keep their files; only the rule goes. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeletingProfile(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
