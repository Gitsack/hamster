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
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

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
}

type FormData = Omit<DownloadClient, 'id'>

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
  const [testResult, setTestResult] = useState<{ success: boolean; version?: string; error?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const openAddDialog = () => {
    setEditingClient(null)
    setFormData(defaultFormData)
    setTestResult(null)
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
    })
    setTestResult(null)
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(client)}
                        >
                          <HugeiconsIcon icon={Edit01Icon} className="h-4 w-4" />
                        </Button>
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
        <DialogContent className="max-w-lg">
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
                className={`flex items-center gap-2 p-3 rounded-md ${
                  testResult.success
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
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
    </AppLayout>
  )
}
