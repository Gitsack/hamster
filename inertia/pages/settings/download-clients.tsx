import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Edit01Icon,
  Delete01Icon,
  FlashIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Folder01Icon,
  File01Icon,
  ArrowLeft01Icon,
  Download01Icon,
  FileImportIcon,
  ComputerIcon,
} from '@hugeicons/core-free-icons'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FolderBrowser } from '@/components/folder-browser'

type DownloadClientType = 'sabnzbd' | 'nzbget' | 'qbittorrent' | 'transmission'

interface DownloadClient {
  id: number
  name: string
  type: DownloadClientType
  host: string
  port: number
  apiKey: string
  username: string
  password: string
  useSsl: boolean
  category: string
  urlBase: string
  enabled: boolean
  priority: number
  removeCompletedDownloads: boolean
  removeFailedDownloads: boolean
  remotePath: string
  localPath: string
  remoteTempPath: string
  localTempPath: string
}

type FormData = Omit<DownloadClient, 'id'>

const isUsenetClient = (type: DownloadClientType) => type === 'sabnzbd' || type === 'nzbget'
const isTorrentClient = (type: DownloadClientType) =>
  type === 'qbittorrent' || type === 'transmission'

const getDefaultPort = (type: DownloadClientType): number => {
  switch (type) {
    case 'sabnzbd':
      return 8080
    case 'nzbget':
      return 6789
    case 'qbittorrent':
      return 8080
    case 'transmission':
      return 9091
    default:
      return 8080
  }
}

interface DownloadItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string | null
}

const defaultFormData: FormData = {
  name: '',
  type: 'sabnzbd',
  host: 'localhost',
  port: 8080,
  apiKey: '',
  username: '',
  password: '',
  useSsl: false,
  category: '',
  urlBase: '',
  enabled: true,
  priority: 1,
  removeCompletedDownloads: true,
  removeFailedDownloads: true,
  remotePath: '',
  localPath: '',
  remoteTempPath: '',
  localTempPath: '',
}

export default function DownloadClients() {
  const [clients, setClients] = useState<DownloadClient[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<DownloadClient | null>(null)
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    version?: string
    error?: string
    remotePath?: string
    pathAccessible?: boolean
    remoteTempPath?: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [showTempFolderBrowser, setShowTempFolderBrowser] = useState(false)
  const [browseDialogOpen, setBrowseDialogOpen] = useState(false)
  const [browsingClient, setBrowsingClient] = useState<DownloadClient | null>(null)
  const [downloadItems, setDownloadItems] = useState<DownloadItem[]>([])
  const [browsingPath, setBrowsingPath] = useState('')
  const [browsingBasePath, setBrowsingBasePath] = useState('')
  const [canGoUp, setCanGoUp] = useState(false)
  const [parentPath, setParentPath] = useState('')
  const [browsingLoading, setBrowsingLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [importingPath, setImportingPath] = useState<string | null>(null)
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/v1/downloadclients')
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      toast.error('Download clients could not be loaded — Hamster is unreachable. Reload to retry.')
    } finally {
      setLoading(false)
    }
  }

  const browseDownloads = async (client: DownloadClient, path?: string) => {
    if (!path) {
      // Initial browse - reset everything
      setBrowsingClient(client)
      setBrowseDialogOpen(true)
    }
    setBrowsingLoading(true)
    setBrowseError(null)

    try {
      const url = path
        ? `/api/v1/downloadclients/${client.id}/browse?path=${encodeURIComponent(path)}`
        : `/api/v1/downloadclients/${client.id}/browse`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setDownloadItems(data.items)
        setBrowsingPath(data.path)
        setBrowsingBasePath(data.basePath)
        setCanGoUp(data.canGoUp)
        setParentPath(data.parentPath)
      } else {
        const error = await response.json()
        setBrowseError(
          error.error ||
            'That folder could not be listed. Check the local path mapping points at a directory Hamster can read.'
        )
      }
    } catch (error) {
      console.error('Failed to browse downloads:', error)
      setBrowseError('Hamster is unreachable, so the folder could not be listed. Try again.')
    } finally {
      setBrowsingLoading(false)
    }
  }

  const navigateToFolder = (folderPath: string) => {
    if (browsingClient) {
      browseDownloads(browsingClient, folderPath)
    }
  }

  const importPath = async (pathToImport: string) => {
    if (!browsingClient) return

    setImportingPath(pathToImport)

    try {
      const response = await fetch(`/api/v1/downloadclients/${browsingClient.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathToImport }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(data.message || `Imported ${data.filesImported} files`)
        // Refresh the folder view
        browseDownloads(browsingClient, browsingPath)
      } else {
        toast.error(
          data.error ||
            data.errors?.[0] ||
            'Nothing was imported. Check the files are complete and that a matching title exists in the library.'
        )
      }
    } catch (error) {
      console.error('Failed to import:', error)
      toast.error('Import could not start — Hamster is unreachable. Try again.')
    } finally {
      setImportingPath(null)
    }
  }

  const downloadToPC = async (pathToDownload: string, itemName: string, isDirectory: boolean) => {
    if (!browsingClient) return

    setDownloadingPath(pathToDownload)

    try {
      const url = `/api/v1/downloadclients/${browsingClient.id}/download?path=${encodeURIComponent(pathToDownload)}`

      // Create a hidden link and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = isDirectory ? `${itemName}.zip` : itemName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(`Downloading ${isDirectory ? `${itemName}.zip` : itemName}`)
    } catch (error) {
      console.error('Failed to download:', error)
      toast.error('The browser refused the download. Check pop-up blocking and try again.')
    } finally {
      // Small delay before clearing state so user sees feedback
      setTimeout(() => setDownloadingPath(null), 500)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${bytes} B`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    )
  }

  const openAddDialog = () => {
    setEditingClient(null)
    setFormData(defaultFormData)
    setTestResult(null)
    setShowFolderBrowser(false)
    setShowTempFolderBrowser(false)
    setDialogOpen(true)
  }

  const openEditDialog = (client: DownloadClient) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      type: client.type,
      host: client.host,
      port: client.port,
      apiKey: client.apiKey || '',
      username: client.username || '',
      password: client.password || '',
      useSsl: client.useSsl,
      category: client.category || '',
      urlBase: client.urlBase || '',
      enabled: client.enabled,
      priority: client.priority,
      removeCompletedDownloads: client.removeCompletedDownloads,
      removeFailedDownloads: client.removeFailedDownloads,
      remotePath: client.remotePath || '',
      localPath: client.localPath || '',
      remoteTempPath: client.remoteTempPath || '',
      localTempPath: client.localTempPath || '',
    })
    setTestResult(null)
    setShowFolderBrowser(false)
    setShowTempFolderBrowser(false)
    setDialogOpen(true)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/v1/downloadclients/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          host: formData.host,
          port: formData.port,
          apiKey: formData.apiKey,
          username: formData.username,
          password: formData.password,
          useSsl: formData.useSsl,
          urlBase: formData.urlBase,
        }),
      })

      const result = await response.json()
      setTestResult(result)

      if (result.success) {
        toast.success(`Connected to ${formData.type} v${result.version}`)

        // Auto-fill remote path mapping if detected
        if (result.remotePath) {
          if (result.pathAccessible) {
            // Path is directly accessible, no mapping needed
            toast.info('Hamster can already read the download folder — no path mapping needed.')
            setFormData((prev) => ({ ...prev, remotePath: '', localPath: '' }))
          } else {
            // Path not accessible, suggest mapping
            toast.warning(
              'Hamster cannot read the download folder. Fill in the local path below so imports can find the files.'
            )
            setFormData((prev) => ({
              ...prev,
              remotePath: prev.remotePath || result.remotePath,
            }))
          }
        }

        // Auto-fill temp path if detected
        if (result.remoteTempPath) {
          setFormData((prev) => ({
            ...prev,
            remoteTempPath: prev.remoteTempPath || result.remoteTempPath,
          }))
        }
      } else {
        toast.error(
          result.error ||
            'The client answered but rejected the credentials. Check the API key or username and password.'
        )
      }
    } catch (error) {
      const message =
        'Could not reach the client. Check the host, port and that it is running — behind Docker, use the container name rather than localhost.'
      setTestResult({ success: false, error: message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const saveClient = async () => {
    if (!formData.name || !formData.host) {
      toast.error('A name and a host are both required before this client can be saved.')
      return
    }

    // Validate credentials based on client type
    if (isUsenetClient(formData.type) && formData.type === 'sabnzbd' && !formData.apiKey) {
      toast.error('SABnzbd needs its API key — find it under Config → General.')
      return
    }
    if (formData.type === 'nzbget' && !formData.username) {
      toast.error('NZBGet needs the control username it was configured with.')
      return
    }

    setSaving(true)

    try {
      const url = editingClient
        ? `/api/v1/downloadclients/${editingClient.id}`
        : '/api/v1/downloadclients'
      const method = editingClient ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingClient ? 'Download client updated' : 'Download client added')
        setDialogOpen(false)
        fetchClients()
      } else {
        const error = await response.json()
        toast.error(
          error.error ||
            'Download client not saved — the server rejected the settings. Check the host, port and credentials.'
        )
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error(
        'Download client not saved — Hamster is unreachable. Check the server and try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteClient = async () => {
    if (!editingClient) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/v1/downloadclients/${editingClient.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Download client deleted')
        setDeleteDialogOpen(false)
        setDialogOpen(false)
        fetchClients()
      } else {
        toast.error('Download client not deleted — the server rejected the request. Try again.')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error(
        'Download client not deleted — Hamster is unreachable. Check the server and try again.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppLayout
      title="Download Clients"
      actions={
        <Button onClick={openAddDialog}>
          <HugeiconsIcon icon={Add01Icon} />
          Add client
        </Button>
      }
    >
      <Head title="Download Clients" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
            <CardDescription>
              The programs Hamster hands NZBs and torrents to, and reads finished downloads back
              from. Each one needs a reachable host and, for imports to work, a path Hamster can
              read.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <HugeiconsIcon
                    icon={Download01Icon}
                    className="size-6 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-medium">No download clients yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Nothing can be grabbed until Hamster has somewhere to send releases. Add SABnzbd,
                  NZBGet, qBittorrent or Transmission to start.
                </p>
                <Button variant="outline" onClick={openAddDialog}>
                  <HugeiconsIcon icon={Add01Icon} />
                  Add client
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase">
                          {client.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="readout text-muted-foreground">
                        {client.useSsl ? 'https' : 'http'}://{client.host}:{client.port}
                      </TableCell>
                      <TableCell>
                        {client.enabled ? (
                          <Badge className="border-transparent bg-status-complete text-white">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <HugeiconsIcon icon={Cancel01Icon} />
                            Paused
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {client.localPath && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => browseDownloads(client)}
                              aria-label={`Browse downloads on ${client.name}`}
                              title="Browse downloads"
                            >
                              <HugeiconsIcon icon={Folder01Icon} className="size-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${client.name}`}
                            onClick={() => openEditDialog(client)}
                          >
                            <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={showFolderBrowser || showTempFolderBrowser ? 'max-w-2xl' : 'max-w-lg'}
        >
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Edit Download Client' : 'Add Download Client'}
            </DialogTitle>
            <DialogDescription>
              How to reach the client, and — if it runs in its own container — how to translate its
              paths into ones Hamster can read.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My SABnzbd"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      type: value as DownloadClientType,
                      port: getDefaultPort(value as DownloadClientType),
                    })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="sabnzbd">SABnzbd</SelectItem>
                    <SelectItem value="nzbget">NZBGet</SelectItem>
                    <SelectItem value="qbittorrent">qBittorrent</SelectItem>
                    <SelectItem value="transmission">Transmission</SelectItem>
                  </SelectPopup>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Switching type resets the port to that client's default.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="host">Host *</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="localhost"
                    className="readout"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) =>
                      setFormData({ ...formData, port: parseInt(e.target.value) || 8080 })
                    }
                    className="readout"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Reachable from this box. Inside Docker that is usually the container name, not
                localhost.
              </p>

              {/* Credentials - varies by client type */}
              {formData.type === 'sabnzbd' && (
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key *</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="Your API key"
                    className="readout"
                  />
                  <p className="text-xs text-muted-foreground">SABnzbd → Config → General.</p>
                </div>
              )}

              {(formData.type === 'nzbget' || isTorrentClient(formData.type)) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">
                      Username {formData.type === 'nzbget' ? '*' : ''}
                    </Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder={formData.type === 'qbittorrent' ? 'admin' : 'nzbget'}
                      className="readout"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Password"
                      className="readout"
                    />
                  </div>
                </div>
              )}

              {/* URL Base for Transmission */}
              {formData.type === 'transmission' && (
                <div className="space-y-2">
                  <Label htmlFor="urlBase">URL Base</Label>
                  <Input
                    id="urlBase"
                    value={formData.urlBase}
                    onChange={(e) => setFormData({ ...formData, urlBase: e.target.value })}
                    placeholder="/transmission (optional)"
                    className="readout"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usually /transmission. Change it only if you changed it in Transmission.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder={
                    isTorrentClient(formData.type) ? 'hamster (optional)' : 'music (optional)'
                  }
                  className="readout"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Keeps Hamster's downloads in their own bucket inside the client.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="useSsl"
                  checked={formData.useSsl}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, useSsl: checked as boolean })
                  }
                />
                <Label htmlFor="useSsl" className="cursor-pointer font-normal">
                  Connect over HTTPS
                </Label>
              </div>
            </div>

            {/* Remote Path Mapping */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Path mapping</h3>
                <p className="text-xs text-muted-foreground">
                  Only needed when the client sees the download folder at a different path than
                  Hamster does — the usual case with separate containers. Run Test and the remote
                  paths fill themselves in.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remotePath">Remote path (complete)</Label>
                <Input
                  id="remotePath"
                  value={formData.remotePath}
                  onChange={(e) => setFormData({ ...formData, remotePath: e.target.value })}
                  placeholder="/downloads/complete"
                  className="readout"
                />
                <p className="text-xs text-muted-foreground">
                  Where finished downloads land, as the client sees it.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="localPath">Local path (complete)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFolderBrowser(!showFolderBrowser)}
                  >
                    {showFolderBrowser ? 'Hide browser' : 'Browse…'}
                  </Button>
                </div>
                {showFolderBrowser ? (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <FolderBrowser
                      value={formData.localPath}
                      onChange={(path) => setFormData({ ...formData, localPath: path })}
                      hideSelectButton
                    />
                  </div>
                ) : (
                  <>
                    <Input
                      id="localPath"
                      value={formData.localPath}
                      onChange={(e) => setFormData({ ...formData, localPath: e.target.value })}
                      placeholder="/mnt/downloads/complete"
                      className="readout"
                    />
                    <p className="text-xs text-muted-foreground">
                      The same folder, as Hamster sees it. Imports fail without this.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="remoteTempPath">Remote path (in progress)</Label>
                <Input
                  id="remoteTempPath"
                  value={formData.remoteTempPath}
                  onChange={(e) => setFormData({ ...formData, remoteTempPath: e.target.value })}
                  placeholder="/downloads/incomplete"
                  className="readout"
                />
                <p className="text-xs text-muted-foreground">
                  Where partial downloads live, as the client sees it.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="localTempPath">Local path (in progress)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTempFolderBrowser(!showTempFolderBrowser)}
                  >
                    {showTempFolderBrowser ? 'Hide browser' : 'Browse…'}
                  </Button>
                </div>
                {showTempFolderBrowser ? (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <FolderBrowser
                      value={formData.localTempPath}
                      onChange={(path) => setFormData({ ...formData, localTempPath: path })}
                      hideSelectButton
                    />
                  </div>
                ) : (
                  <>
                    <Input
                      id="localTempPath"
                      value={formData.localTempPath}
                      onChange={(e) => setFormData({ ...formData, localTempPath: e.target.value })}
                      placeholder="/tmp/downloads"
                      className="readout"
                    />
                    <p className="text-xs text-muted-foreground">
                      Point this at local disk rather than a NAS mount — partial writes are the
                      slowest part of a grab.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-6">
              <Checkbox
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked as boolean })
                }
              />
              <Label htmlFor="enabled" className="cursor-pointer font-normal">
                Send grabs to this client
              </Label>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                role="status"
                className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${
                  testResult.success
                    ? 'border-status-complete/40 bg-status-complete/10'
                    : 'border-destructive/40 bg-destructive/10'
                }`}
              >
                <div className="flex items-start gap-2">
                  <HugeiconsIcon
                    icon={testResult.success ? CheckmarkCircle01Icon : Cancel01Icon}
                    className={`mt-0.5 size-4 shrink-0 ${
                      testResult.success ? 'text-status-complete-ink' : 'text-destructive'
                    }`}
                  />
                  <span className="text-foreground">
                    {testResult.success ? (
                      <>
                        Connected — <span className="readout">v{testResult.version}</span>
                      </>
                    ) : (
                      testResult.error ||
                      'The client did not answer. Check the host, port and that it is running.'
                    )}
                  </span>
                </div>
                {testResult.success && testResult.remotePath && (
                  <div className="space-y-1 pl-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-foreground/70">Complete folder</span>
                      <code className="readout rounded-sm bg-muted px-1 text-xs">
                        {testResult.remotePath}
                      </code>
                      {testResult.pathAccessible ? (
                        <Badge className="border-transparent bg-status-complete text-white">
                          Readable
                        </Badge>
                      ) : (
                        <Badge className="border-transparent bg-status-queued text-white">
                          Needs path mapping
                        </Badge>
                      )}
                    </div>
                    {testResult.remoteTempPath && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-foreground/70">In-progress folder</span>
                        <code className="readout rounded-sm bg-muted px-1 text-xs">
                          {testResult.remoteTempPath}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {editingClient && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="sm:mr-auto"
              >
                <HugeiconsIcon icon={Delete01Icon} />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={testConnection} disabled={testing || !formData.host}>
              {testing ? <Spinner /> : <HugeiconsIcon icon={FlashIcon} />}
              Test
            </Button>
            <Button onClick={saveClient} disabled={saving}>
              {saving ? <Spinner /> : null}
              {editingClient ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {editingClient?.name}?</DialogTitle>
            <DialogDescription>
              Hamster stops sending grabs here and stops watching this client's folders. Downloads
              already running in the client itself keep going. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteClient} disabled={deleting}>
              {deleting ? <Spinner /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Browse Downloads Dialog */}
      <Dialog open={browseDialogOpen} onOpenChange={setBrowseDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {canGoUp && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Go up one folder"
                  onClick={() => navigateToFolder(parentPath)}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                </Button>
              )}
              Downloads — {browsingClient?.name}
            </DialogTitle>
            <DialogDescription className="readout truncate text-xs">
              {browsingPath}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-[300px] flex-1 overflow-auto">
            {browsingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : browseError ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <p className="max-w-md text-sm text-destructive">{browseError}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Set the local path on this client so Hamster and the client agree on where the
                  files are.
                </p>
              </div>
            ) : downloadItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    className="size-6 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-medium">Folder is empty</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Nothing is waiting here. Finished downloads appear once the client moves them out
                  of its in-progress folder.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead data-numeric className="w-24">
                      Size
                    </TableHead>
                    <TableHead data-numeric className="w-40">
                      Modified
                    </TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloadItems.map((item) => (
                    <TableRow key={item.path}>
                      <TableCell>
                        <HugeiconsIcon
                          icon={item.isDirectory ? Folder01Icon : File01Icon}
                          className="size-4 text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell>
                        {item.isDirectory ? (
                          <button
                            onClick={() => navigateToFolder(item.path)}
                            className="readout rounded-sm text-left outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <span className="readout">{item.name}</span>
                        )}
                      </TableCell>
                      <TableCell data-numeric className="text-muted-foreground">
                        {formatFileSize(item.size)}
                      </TableCell>
                      <TableCell data-numeric className="text-muted-foreground">
                        {formatDate(item.modifiedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => downloadToPC(item.path, item.name, item.isDirectory)}
                            disabled={downloadingPath === item.path}
                            aria-label={`Download ${item.name} to this computer`}
                            title="Download to this computer"
                          >
                            {downloadingPath === item.path ? (
                              <Spinner />
                            ) : (
                              <HugeiconsIcon icon={ComputerIcon} className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => importPath(item.path)}
                            disabled={importingPath === item.path}
                            aria-label={`Import ${item.name} into the library`}
                            title="Import to library"
                          >
                            {importingPath === item.path ? (
                              <Spinner />
                            ) : (
                              <HugeiconsIcon icon={FileImportIcon} className="size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBrowseDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
