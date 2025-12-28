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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Folder01Icon,
  Delete02Icon,
  Add01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  MusicNote01Icon,
  Video01Icon,
  Tv01Icon,
  Download01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

type MediaType = 'music' | 'movies' | 'tv'

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
  downloadFolder: string
  enabledMediaTypes: MediaType[]
}

const mediaTypeInfo: Record<MediaType, { label: string; icon: any; description: string }> = {
  music: {
    label: 'Music',
    icon: MusicNote01Icon,
    description: 'Manage your music library with artist and album organization',
  },
  movies: {
    label: 'Movies',
    icon: Video01Icon,
    description: 'Organize your movie collection (coming soon)',
  },
  tv: {
    label: 'TV Shows',
    icon: Tv01Icon,
    description: 'Track and organize TV series (coming soon)',
  },
}

export default function MediaManagement() {
  const [settings, setSettings] = useState<AppSettings>({
    downloadFolder: '',
    enabledMediaTypes: ['music'],
  })
  const [rootFolders, setRootFolders] = useState<RootFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMediaType, setEditingMediaType] = useState<MediaType>('music')
  const [newPath, setNewPath] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloadFolderInput, setDownloadFolderInput] = useState('')
  const [savingDownloadFolder, setSavingDownloadFolder] = useState(false)

  const fetchData = async () => {
    try {
      const [settingsRes, foldersRes] = await Promise.all([
        fetch('/api/v1/settings'),
        fetch('/api/v1/rootfolders'),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data)
        setDownloadFolderInput(data.downloadFolder || '')
      }
      if (foldersRes.ok) {
        const data = await foldersRes.json()
        setRootFolders(data)
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

  const handleSaveDownloadFolder = async () => {
    if (!downloadFolderInput.trim()) {
      toast.error('Download folder path is required')
      return
    }

    setSavingDownloadFolder(true)
    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadFolder: downloadFolderInput }),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        toast.success('Download folder saved')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save download folder')
      }
    } catch (error) {
      toast.error('Failed to save download folder')
    } finally {
      setSavingDownloadFolder(false)
    }
  }

  const handleToggleMediaType = async (mediaType: MediaType, enabled: boolean) => {
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

  const openAddFolderDialog = (mediaType: MediaType) => {
    setEditingMediaType(mediaType)
    setNewPath('')
    setNewName('')
    setDialogOpen(true)
  }

  const handleAddFolder = async () => {
    if (!newPath.trim()) {
      toast.error('Path is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/v1/rootfolders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: newPath,
          name: newName || undefined,
          mediaType: editingMediaType,
        }),
      })

      if (response.ok) {
        toast.success('Folder added')
        setDialogOpen(false)
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add folder')
      }
    } catch (error) {
      toast.error('Failed to add folder')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFolder = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/rootfolders/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Folder removed')
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to remove folder')
      }
    } catch (error) {
      toast.error('Failed to remove folder')
    }
  }

  const getFoldersForMediaType = (mediaType: MediaType) => {
    return rootFolders.filter((folder) => folder.mediaType === mediaType)
  }

  return (
    <AppLayout title="Media Management">
      <Head title="Media Management" />

      <div className="space-y-6">
        {/* Download Folder */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={Download01Icon} className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle>Download Folder</CardTitle>
                <CardDescription>
                  Where downloaded files are placed before being imported
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="/path/to/downloads"
                value={downloadFolderInput}
                onChange={(e) => setDownloadFolderInput(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSaveDownloadFolder}
                disabled={savingDownloadFolder || downloadFolderInput === settings.downloadFolder}
              >
                {savingDownloadFolder ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Media Types */}
        <Card>
          <CardHeader>
            <CardTitle>Media Types</CardTitle>
            <CardDescription>
              Enable media types to manage. Each type has its own library and folder settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(mediaTypeInfo) as MediaType[]).map((mediaType) => {
              const info = mediaTypeInfo[mediaType]
              const isEnabled = settings.enabledMediaTypes.includes(mediaType)
              const isDisabled = mediaType !== 'music' // Only music is available for now

              return (
                <div
                  key={mediaType}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    isEnabled ? 'border-primary/50 bg-primary/5' : ''
                  } ${isDisabled ? 'opacity-50' : ''}`}
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
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{info.label}</span>
                        {isDisabled && (
                          <Badge variant="secondary" className="text-xs">
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggleMediaType(mediaType, checked)}
                    disabled={isDisabled}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Media Library Folders - one section per enabled media type */}
        {settings.enabledMediaTypes.map((mediaType) => {
          const info = mediaTypeInfo[mediaType]
          const folders = getFoldersForMediaType(mediaType)

          return (
            <Card key={mediaType}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <HugeiconsIcon icon={info.icon} className="size-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{info.label} Library</CardTitle>
                      <CardDescription>
                        Folder where your {info.label.toLowerCase()} files are stored
                      </CardDescription>
                    </div>
                  </div>
                  <Button onClick={() => openAddFolderDialog(mediaType)}>
                    <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
                    Add Folder
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : folders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No folders configured for {info.label.toLowerCase()}.
                    <br />
                    Add a folder to start organizing your library.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {folders.map((folder) => (
                        <TableRow key={folder.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <HugeiconsIcon
                                icon={Folder01Icon}
                                className="size-4 text-muted-foreground"
                              />
                              {folder.name}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{folder.path}</TableCell>
                          <TableCell>
                            {folder.accessible ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                                <span>Accessible</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-destructive">
                                <HugeiconsIcon icon={Alert02Icon} className="size-4" />
                                <span>Not accessible</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFolder(folder.id)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                className="size-4 text-destructive"
                              />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* File Naming */}
        <Card>
          <CardHeader>
            <CardTitle>File Naming</CardTitle>
            <CardDescription>Configure how files are named and organized</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Standard Track Format</Label>
                <Input
                  value="{Album Title} ({Release Year})/{track:00} - {Track Title}"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Example: Thriller (1982)/01 - Wanna Be Startin&apos; Somethin&apos;.flac
                </p>
              </div>
              <div className="space-y-2">
                <Label>Artist Folder Format</Label>
                <Input value="{Artist Name}" disabled />
                <p className="text-xs text-muted-foreground">Example: Michael Jackson/</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Folder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {mediaTypeInfo[editingMediaType].label} Folder</DialogTitle>
            <DialogDescription>
              Add a folder where your {mediaTypeInfo[editingMediaType].label.toLowerCase()} files
              are stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="path">Path</Label>
              <Input
                id="path"
                placeholder={`/path/to/${editingMediaType}`}
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
              />
            </div>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFolder} disabled={saving}>
              {saving ? 'Adding...' : 'Add Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
