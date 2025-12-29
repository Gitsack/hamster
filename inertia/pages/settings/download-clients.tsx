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
import {
  Select,
  SelectPopup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Loading01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Folder01Icon,
  File01Icon,
  ArrowLeft01Icon,
  Download01Icon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FolderBrowser } from '@/components/folder-browser'

interface DownloadClient {
  id: number
  name: string
  type: 'sabnzbd' | 'nzbget'
  host: string
  port: number
  apiKey: string
  useSsl: boolean
  category: string
  enabled: boolean
  priority: number
  removeCompletedDownloads: boolean
  removeFailedDownloads: boolean
  remotePath: string
  localPath: string
}

type FormData = Omit<DownloadClient, 'id'>

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
  useSsl: false,
  category: '',
  enabled: true,
  priority: 1,
  removeCompletedDownloads: true,
  removeFailedDownloads: true,
  remotePath: '',
  localPath: '',
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
  const [testResult, setTestResult] = useState<{ success: boolean; version?: string; error?: string; remotePath?: string; pathAccessible?: boolean } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
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
      toast.error('Failed to load download clients')
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
        setBrowseError(error.error || 'Failed to browse downloads')
      }
    } catch (error) {
      console.error('Failed to browse downloads:', error)
      setBrowseError('Failed to connect to server')
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
        toast.error(data.error || data.errors?.[0] || 'Import failed')
      }
    } catch (error) {
      console.error('Failed to import:', error)
      toast.error('Failed to import')
    } finally {
      setImportingPath(null)
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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const openAddDialog = () => {
    setEditingClient(null)
    setFormData(defaultFormData)
    setTestResult(null)
    setShowFolderBrowser(false)
    setDialogOpen(true)
  }

  const openEditDialog = (client: DownloadClient) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      type: client.type,
      host: client.host,
      port: client.port,
      apiKey: client.apiKey,
      useSsl: client.useSsl,
      category: client.category,
      enabled: client.enabled,
      priority: client.priority,
      removeCompletedDownloads: client.removeCompletedDownloads,
      removeFailedDownloads: client.removeFailedDownloads,
      remotePath: client.remotePath || '',
      localPath: client.localPath || '',
    })
    setTestResult(null)
    setShowFolderBrowser(false)
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
          useSsl: formData.useSsl,
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
            toast.info('Download path is directly accessible - no path mapping needed')
            setFormData((prev) => ({ ...prev, remotePath: '', localPath: '' }))
          } else {
            // Path not accessible, suggest mapping
            toast.warning('Download path not accessible locally - please configure path mapping')
            setFormData((prev) => ({
              ...prev,
              remotePath: prev.remotePath || result.remotePath,
            }))
          }
        }
      } else {
        toast.error(result.error || 'Connection failed')
      }
    } catch (error) {
      const errorResult = { success: false, error: 'Connection failed' }
      setTestResult(errorResult)
      toast.error('Connection failed')
    } finally {
      setTesting(false)
    }
  }

  const saveClient = async () => {
    if (!formData.name || !formData.host || !formData.apiKey) {
      toast.error('Please fill in all required fields')
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
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save download client')
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
        toast.error('Failed to delete download client')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Failed to delete download client')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppLayout
      title="Download Clients"
      actions={
        <Button onClick={openAddDialog}>
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      }
    >
      <Head title="Download Clients" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Download Clients</CardTitle>
            <CardDescription>
              Configure download clients to process NZB files. SABnzbd is the recommended client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <HugeiconsIcon icon={Loading01Icon} className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No download clients configured.</p>
                <p className="mt-2">Add a download client to start downloading.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
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
                      <TableCell className="text-muted-foreground">
                        {client.useSsl ? 'https' : 'http'}://{client.host}:{client.port}
                      </TableCell>
                      <TableCell>
                        {client.enabled ? (
                          <Badge variant="default" className="bg-green-500">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {client.localPath && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => browseDownloads(client)}
                              title="Browse downloads"
                            >
                              <HugeiconsIcon icon={Folder01Icon} className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(client)}
                          >
                            <HugeiconsIcon icon={Edit01Icon} className="h-4 w-4" />
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
        <DialogContent className={showFolderBrowser ? "max-w-2xl" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Edit Download Client' : 'Add Download Client'}
            </DialogTitle>
            <DialogDescription>
              Configure your download client connection settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                    type: value as 'sabnzbd' | 'nzbget',
                    port: value === 'sabnzbd' ? 8080 : 6789,
                  })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="sabnzbd">SABnzbd</SelectItem>
                  <SelectItem value="nzbget">NZBGet</SelectItem>
                </SelectPopup>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="host">Host *</Label>
                <Input
                  id="host"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port *</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 8080 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key *</Label>
              <Input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Your API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="music (optional)"
              />
            </div>

            {/* Remote Path Mapping */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label className="text-base font-medium">Remote Path Mapping</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Required if SABnzbd runs in Docker with different paths than MediaBox.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remotePath">Remote Path</Label>
                <Input
                  id="remotePath"
                  value={formData.remotePath}
                  onChange={(e) => setFormData({ ...formData, remotePath: e.target.value })}
                  placeholder="/downloads"
                />
                <p className="text-xs text-muted-foreground">Path as SABnzbd sees it (auto-detected when you test connection)</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="localPath">Local Path</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFolderBrowser(!showFolderBrowser)}
                    className="h-7 text-xs"
                  >
                    {showFolderBrowser ? 'Hide Browser' : 'Browse...'}
                  </Button>
                </div>
                {showFolderBrowser ? (
                  <div className="rounded-lg border bg-muted/30 p-3">
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
                      placeholder="/mnt/downloads"
                    />
                    <p className="text-xs text-muted-foreground">Path as MediaBox sees it</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="useSsl"
                checked={formData.useSsl}
                onCheckedChange={(checked) => setFormData({ ...formData, useSsl: checked as boolean })}
              />
              <Label htmlFor="useSsl" className="font-normal cursor-pointer">
                Use SSL
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked as boolean })}
              />
              <Label htmlFor="enabled" className="font-normal cursor-pointer">
                Enabled
              </Label>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`flex flex-col gap-2 p-3 rounded-md ${
                  testResult.success
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={testResult.success ? CheckmarkCircle01Icon : Cancel01Icon}
                    className="h-5 w-5"
                  />
                  <span>
                    {testResult.success
                      ? `Connected successfully (v${testResult.version})`
                      : testResult.error || 'Connection failed'}
                  </span>
                </div>
                {testResult.success && testResult.remotePath && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Complete folder: </span>
                    <code className="bg-muted px-1 rounded">{testResult.remotePath}</code>
                    {testResult.pathAccessible ? (
                      <span className="text-green-600 ml-2">(accessible)</span>
                    ) : (
                      <span className="text-orange-500 ml-2">(needs path mapping)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingClient && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="sm:mr-auto"
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={testConnection} disabled={testing || !formData.host || !formData.apiKey}>
              {testing ? (
                <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <HugeiconsIcon icon={FlashIcon} className="h-4 w-4 mr-2" />
              )}
              Test
            </Button>
            <Button onClick={saveClient} disabled={saving}>
              {saving ? (
                <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
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
              This will remove the download client configuration. Active downloads will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteClient} disabled={deleting}>
              {deleting ? (
                <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
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
                  size="sm"
                  onClick={() => navigateToFolder(parentPath)}
                  className="h-8 w-8 p-0"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                </Button>
              )}
              Downloads - {browsingClient?.name}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs truncate">
              {browsingPath}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-[300px]">
            {browsingLoading ? (
              <div className="flex items-center justify-center py-12">
                <HugeiconsIcon icon={Loading01Icon} className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : browseError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive mb-2">{browseError}</p>
                <p className="text-sm text-muted-foreground">
                  Make sure the local path is configured and accessible.
                </p>
              </div>
            ) : downloadItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <HugeiconsIcon icon={Folder01Icon} className="h-12 w-12 mb-4 opacity-50" />
                <p>No files in downloads folder</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-24 text-right">Size</TableHead>
                    <TableHead className="w-40 text-right">Modified</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloadItems.map((item) => (
                    <TableRow key={item.path}>
                      <TableCell>
                        <HugeiconsIcon
                          icon={item.isDirectory ? Folder01Icon : File01Icon}
                          className={`h-4 w-4 ${item.isDirectory ? 'text-blue-500' : 'text-muted-foreground'}`}
                        />
                      </TableCell>
                      <TableCell>
                        {item.isDirectory ? (
                          <button
                            onClick={() => navigateToFolder(item.path)}
                            className="font-medium text-left hover:text-primary hover:underline transition-colors"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <span className="font-medium">{item.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatFileSize(item.size)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatDate(item.modifiedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => importPath(item.path)}
                          disabled={importingPath === item.path}
                          title="Import to library"
                        >
                          {importingPath === item.path ? (
                            <HugeiconsIcon icon={Loading01Icon} className="h-4 w-4 animate-spin" />
                          ) : (
                            <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
                          )}
                        </Button>
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
