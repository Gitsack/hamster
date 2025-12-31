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
import { Switch } from '@/components/ui/switch'
import {
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsiblePanel,
} from '@/components/ui/accordion'
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

interface AppSettings {
  enabledMediaTypes: MediaType[]
  hasTmdbApiKey: boolean
}

const mediaTypeInfo: Record<MediaType, { label: string; icon: any; description: string; needsApiKey?: boolean }> = {
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

export default function MediaManagement() {
  const [settings, setSettings] = useState<AppSettings>({
    enabledMediaTypes: ['music'],
    hasTmdbApiKey: false,
  })
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([])
  const [loading, setLoading] = useState(true)

  // Naming patterns state
  const [namingData, setNamingData] = useState<NamingPatternsData | null>(null)
  const [editedPatterns, setEditedPatterns] = useState<Record<MediaType, Record<string, string>>>({} as any)
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

  const fetchData = async () => {
    try {
      const [settingsRes, foldersRes, namingRes] = await Promise.all([
        fetch('/api/v1/settings'),
        fetch('/api/v1/rootfolders'),
        fetch('/api/v1/settings/naming-patterns'),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data)
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
      toast.error(`Please configure your TMDB API key first to enable ${mediaTypeInfo[mediaType].label}`)
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
        setNamingData((prev) => prev ? {
          ...prev,
          patterns: {
            ...prev.patterns,
            [mediaType]: data.patterns,
          },
          examples: {
            ...prev.examples,
            [mediaType]: data.examples,
          },
        } : null)
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

  return (
    <AppLayout title="Media Management">
      <Head title="Media Management" />

      <div className="space-y-6">
        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Configure API keys for metadata providers
            </CardDescription>
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
                          isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
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
                          <HugeiconsIcon icon={Folder01Icon} className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Library Folder</span>
                        </div>
                        {folder ? (
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">{folder.path}</code>
                            {folder.accessible ? (
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-green-600" />
                            ) : (
                              <HugeiconsIcon icon={Alert02Icon} className="size-4 text-destructive" />
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openFolderDialog(mediaType)}>
                              <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => openFolderDialog(mediaType)}>
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
                            {namingData && editedPatterns[mediaType] && Object.entries(editedPatterns[mediaType]).map(([field, pattern]) => {
                              const variables = namingData.variables[mediaType]?.[field] || []
                              const example = getExampleForPattern(mediaType, field, pattern)
                              return (
                                <div key={field} className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">
                                    {fieldLabels[field] || field}
                                  </Label>
                                  <Input
                                    value={pattern}
                                    onChange={(e) => handlePatternChange(mediaType, field, e.target.value)}
                                    className="h-8 text-sm font-mono"
                                  />
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {variables.map((v) => (
                                      <button
                                        key={v.name}
                                        type="button"
                                        onClick={() => handlePatternChange(mediaType, field, pattern + `{${v.name}}`)}
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
              Select a folder where your {mediaTypeInfo[editingMediaType].label.toLowerCase()} files are stored.
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
              Enter your TMDB API key to enable Movies and TV Shows metadata.
              You can get a free API key at{' '}
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
    </AppLayout>
  )
}
