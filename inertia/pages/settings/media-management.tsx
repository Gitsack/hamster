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
import {
  Select,
  SelectPopup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Settings01Icon,
  Globe02Icon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { FolderBrowser } from '@/components/folder-browser'

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

interface AppSettings {
  enabledMediaTypes: MediaType[]
  hasTmdbApiKey: boolean
  hasTraktClientId: boolean
  recommendationSettings: RecommendationSettings
  justwatchEnabled: boolean
  justwatchLocale: string
}

const mediaTypeInfo: Record<
  MediaType,
  { label: string; icon: any; description: string; needsApiKey?: boolean }
> = {
  music: {
    label: 'Music',
    icon: MusicNote01Icon,
    description: 'Artist and album organization with MusicBrainz metadata',
  },
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
  items: QualityItem[]
}

// Quality options per media type
const QUALITY_OPTIONS: Record<MediaType, { id: number; name: string }[]> = {
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
    enabledMediaTypes: ['music'],
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
  })
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([])
  const [loading, setLoading] = useState(true)

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
  const [savingQuality, setSavingQuality] = useState(false)

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
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleToggleMediaType = async (mediaType: MediaType, enabled: boolean) => {
    // Check if TMDB API key is needed
    if (enabled && mediaTypeInfo[mediaType].needsApiKey && !settings.hasTmdbApiKey) {
      toast.error(
        `Please configure your TMDB API key first to enable ${mediaTypeInfo[mediaType].label}`
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
        toast.error('Failed to update media type')
      }
    } catch (error) {
      toast.error('Failed to update media type')
    }
  }

  const getFolderForMediaType = (mediaType: MediaType) => {
    return rootFolders.find((folder) => folder.mediaType === mediaType)
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
      toast.error('Path is required')
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
          toast.error(error.error || 'Failed to update folder')
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
          toast.error(error.error || 'Failed to add folder')
        }
      }
    } catch (error) {
      toast.error('Failed to save folder')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveApiKey = async () => {
    if (!tmdbApiKey.trim()) {
      toast.error('API key is required')
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
        toast.error('Failed to save API key')
      }
    } catch (error) {
      toast.error('Failed to save API key')
    } finally {
      setSavingApiKey(false)
    }
  }

  const handleSaveTraktKey = async () => {
    if (!traktClientId.trim()) {
      toast.error('Client ID is required')
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
        toast.error('Failed to save Trakt client ID')
      }
    } catch (error) {
      toast.error('Failed to save Trakt client ID')
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
        toast.error('Failed to save recommendation settings')
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to save recommendation settings')
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
        toast.error('Failed to save settings')
        fetchData()
      }
    } catch {
      toast.error('Failed to save settings')
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
        toast.error('Failed to save locale')
        fetchData()
      }
    } catch {
      toast.error('Failed to save locale')
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
        toast.error(error.error || 'Failed to save patterns')
      }
    } catch (error) {
      toast.error('Failed to save patterns')
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
    } else {
      setEditingQuality(null)
      setQualityName('')
      // Initialize with all items enabled
      setQualityItems(QUALITY_OPTIONS[mediaType].map((q) => ({ ...q, allowed: true })))
      setQualityUpgradeAllowed(true)
    }
    setQualityDialogOpen(true)
  }

  const handleSaveQuality = async () => {
    if (!qualityName.trim()) {
      toast.error('Profile name is required')
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
        toast.error(error.error || 'Failed to save profile')
      }
    } catch (error) {
      toast.error('Failed to save profile')
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
        toast.error('Failed to delete profile')
      }
    } catch (error) {
      toast.error('Failed to delete profile')
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

  return (
    <AppLayout title="Media Management">
      <Head title="Media Management" />

      <div className="space-y-6">
        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Configure API keys for metadata providers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={Key01Icon} className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-medium">TMDB API Key</span>
                  <p className="text-sm text-muted-foreground">
                    Required for Movies and TV Shows metadata.{' '}
                    <a
                      href="https://www.themoviedb.org/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Get one free
                    </a>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.hasTmdbApiKey ? (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                    Configured
                  </span>
                ) : (
                  <span className="text-sm text-orange-500 flex items-center gap-1">
                    <HugeiconsIcon icon={Alert02Icon} className="size-4" />
                    Not configured
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => setApiKeyDialogOpen(true)}>
                  {settings.hasTmdbApiKey ? 'Change' : 'Add'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>
              Configure recommendation sources for the search page discover lanes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Trakt.tv row */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={Globe02Icon} className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-medium">Trakt.tv</span>
                  <p className="text-sm text-muted-foreground">
                    Community-powered trending, anticipated, and recommended lists.{' '}
                    <a
                      href="https://trakt.tv/oauth/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Get a free client ID
                    </a>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.hasTraktClientId ? (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                    Configured
                  </span>
                ) : (
                  <span className="text-sm text-orange-500 flex items-center gap-1">
                    <HugeiconsIcon icon={Alert02Icon} className="size-4" />
                    Not configured
                  </span>
                )}
                <Switch
                  checked={settings.recommendationSettings.traktEnabled}
                  onCheckedChange={(checked) =>
                    handleSaveRecommendationSettings({
                      ...settings.recommendationSettings,
                      traktEnabled: checked,
                    })
                  }
                  disabled={!settings.hasTraktClientId}
                />
                <Button variant="outline" size="sm" onClick={() => setTraktDialogOpen(true)}>
                  {settings.hasTraktClientId ? 'Change' : 'Set Client ID'}
                </Button>
              </div>
            </div>

            {/* JustWatch row */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={Tv01Icon} className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-medium">JustWatch</span>
                  <p className="text-sm text-muted-foreground">
                    Show streaming availability and popular streaming content.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.justwatchEnabled && (
                  <Select
                    value={settings.justwatchLocale}
                    onValueChange={(value) => handleJustWatchLocaleChange(value)}
                  >
                    <SelectTrigger className="w-36">
                      <span className="truncate">
                        {LOCALE_DISPLAY_NAMES[settings.justwatchLocale] ||
                          settings.justwatchLocale}
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
                  onCheckedChange={handleJustWatchToggle}
                />
              </div>
            </div>

            {/* Personalized Recommendations row */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={StarIcon} className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-medium">Personalized Recommendations</span>
                  <p className="text-sm text-muted-foreground">
                    "Because you have..." lanes based on your library. Uses TMDB recommendations API.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                    <SelectTrigger className="w-24">
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
                  onCheckedChange={(checked) =>
                    handleSaveRecommendationSettings({
                      ...settings.recommendationSettings,
                      personalizedEnabled: checked,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media Types */}
        <Card>
          <CardHeader>
            <CardTitle>Media Types</CardTitle>
            <CardDescription>
              Enable media types and configure their library folders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(mediaTypeInfo) as MediaType[]).map((mediaType) => {
              const info = mediaTypeInfo[mediaType]
              const isEnabled = settings.enabledMediaTypes.includes(mediaType)
              const folder = getFolderForMediaType(mediaType)

              return (
                <div
                  key={mediaType}
                  className={`rounded-lg border ${isEnabled ? 'border-primary/50' : ''}`}
                >
                  {/* Media type header */}
                  <div
                    className={`flex items-center justify-between p-4 ${
                      isEnabled ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          isEnabled
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <HugeiconsIcon icon={info.icon} className="size-5" />
                      </div>
                      <div>
                        <span className="font-medium">{info.label}</span>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggleMediaType(mediaType, checked)}
                    />
                  </div>

                  {/* Folder configuration and file naming (shown when enabled) */}
                  {isEnabled && (
                    <div className="border-t bg-muted/30">
                      {/* Library Folder */}
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-2">
                          <HugeiconsIcon
                            icon={Folder01Icon}
                            className="size-4 text-muted-foreground"
                          />
                          <span className="text-sm font-medium">Library Folder</span>
                        </div>
                        {folder ? (
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {folder.path}
                            </code>
                            {folder.accessible ? (
                              <HugeiconsIcon
                                icon={CheckmarkCircle02Icon}
                                className="size-4 text-green-600"
                              />
                            ) : (
                              <HugeiconsIcon
                                icon={Alert02Icon}
                                className="size-4 text-destructive"
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openFolderDialog(mediaType)}
                            >
                              <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openFolderDialog(mediaType)}
                          >
                            <HugeiconsIcon icon={Add01Icon} className="size-4 mr-1" />
                            Set Folder
                          </Button>
                        )}
                      </div>

                      {/* File Naming (collapsible) */}
                      <CollapsibleRoot className="border-t">
                        <div className="p-4">
                          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground">
                            File Organization
                          </CollapsibleTrigger>
                        </div>
                        <CollapsiblePanel>
                          <div className="space-y-4 px-4 pb-4">
                            {namingData &&
                              editedPatterns[mediaType] &&
                              Object.entries(editedPatterns[mediaType]).map(([field, pattern]) => {
                                const variables = namingData.variables[mediaType]?.[field] || []
                                const example = getExampleForPattern(mediaType, field, pattern)
                                return (
                                  <div key={field} className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                      {fieldLabels[field] || field}
                                    </Label>
                                    <Input
                                      value={pattern}
                                      onChange={(e) =>
                                        handlePatternChange(mediaType, field, e.target.value)
                                      }
                                      className="h-8 text-sm font-mono"
                                    />
                                    <div className="flex flex-wrap gap-1 mt-1">
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
                                          className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground font-mono"
                                          title={v.description}
                                        >
                                          {`{${v.name}}`}
                                        </button>
                                      ))}
                                    </div>
                                    {example && (
                                      <p className="text-xs text-muted-foreground">
                                        Example: {example}
                                      </p>
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
                                {savingPatterns[mediaType] ? 'Saving...' : 'Save Changes'}
                              </Button>
                            )}
                          </div>
                        </CollapsiblePanel>
                      </CollapsibleRoot>

                      {/* Quality Profiles (collapsible) */}
                      <CollapsibleRoot className="border-t">
                        <div className="p-4">
                          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground">
                            Quality Profiles
                          </CollapsibleTrigger>
                        </div>
                        <CollapsiblePanel>
                          <div className="space-y-3 px-4 pb-4">
                            <p className="text-sm text-muted-foreground">
                              Define which quality levels are acceptable for downloads.
                            </p>
                            {getProfilesForMediaType(mediaType).length > 0 ? (
                              <div className="space-y-2">
                                {getProfilesForMediaType(mediaType).map((profile) => (
                                  <div
                                    key={profile.id}
                                    className="flex items-center justify-between rounded-md border p-3"
                                  >
                                    <div>
                                      <span className="font-medium">{profile.name}</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {profile.items
                                          .filter((i) => i.allowed)
                                          .map((item) => (
                                            <Badge
                                              key={item.id}
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {item.name}
                                            </Badge>
                                          ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openQualityDialog(mediaType, profile)}
                                      >
                                        <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
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
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                No quality profiles configured.
                              </p>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openQualityDialog(mediaType)}
                            >
                              <HugeiconsIcon icon={Add01Icon} className="size-4 mr-1" />
                              Add Profile
                            </Button>
                          </div>
                        </CollapsiblePanel>
                      </CollapsibleRoot>
                    </div>
                  )}
                </div>
              )
            })}
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
              Select a folder where your {mediaTypeInfo[editingMediaType].label.toLowerCase()} files
              are stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FolderBrowser
              value={newPath}
              onChange={setNewPath}
              createIfMissing={createIfMissing}
              onCreateIfMissingChange={setCreateIfMissing}
            />
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder={`My ${mediaTypeInfo[editingMediaType].label} Library`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFolder} disabled={saving || !newPath}>
              {saving ? 'Saving...' : 'Save'}
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
              Enter your TMDB API key to enable Movies and TV Shows metadata. You can get a free API
              key at{' '}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                themoviedb.org
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key (v3 auth)</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter your TMDB API key"
                  value={tmdbApiKey}
                  onChange={(e) => setTmdbApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  <HugeiconsIcon icon={showApiKey ? ViewOffIcon : EyeIcon} className="size-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKey} disabled={savingApiKey || !tmdbApiKey.trim()}>
              {savingApiKey ? 'Saving...' : 'Save'}
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
              Enter your Trakt client ID to enable community-powered recommendations. You can get a
              free client ID at{' '}
              <a
                href="https://trakt.tv/oauth/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                trakt.tv
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="traktClientId">Client ID</Label>
              <div className="relative">
                <Input
                  id="traktClientId"
                  type={showTraktKey ? 'text' : 'password'}
                  placeholder="Enter your Trakt client ID"
                  value={traktClientId}
                  onChange={(e) => setTraktClientId(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowTraktKey(!showTraktKey)}
                >
                  <HugeiconsIcon icon={showTraktKey ? ViewOffIcon : EyeIcon} className="size-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTraktDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTraktKey}
              disabled={savingTraktKey || !traktClientId.trim()}
            >
              {savingTraktKey ? 'Saving...' : 'Save'}
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
              Define which quality levels are acceptable for{' '}
              {mediaTypeInfo[qualityMediaType].label.toLowerCase()} downloads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="qualityName">Profile Name</Label>
              <Input
                id="qualityName"
                placeholder="e.g., High Quality"
                value={qualityName}
                onChange={(e) => setQualityName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed Qualities</Label>
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
                        className="font-normal cursor-pointer text-sm"
                      >
                        {option.name}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="upgradeAllowed"
                checked={qualityUpgradeAllowed}
                onCheckedChange={setQualityUpgradeAllowed}
              />
              <Label htmlFor="upgradeAllowed" className="font-normal cursor-pointer">
                Upgrade existing files when better quality is available
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
              {savingQuality ? 'Saving...' : editingQuality ? 'Save' : 'Add'}
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
              Are you sure you want to delete the quality profile "{deletingProfile?.name}"? This
              action cannot be undone.
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
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
