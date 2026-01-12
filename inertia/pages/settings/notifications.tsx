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
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface NotificationProvider {
  id: string
  name: string
  type: 'discord' | 'telegram' | 'pushover' | 'slack' | 'gotify' | 'email'
  enabled: boolean
  settings: Record<string, unknown>
  onGrab: boolean
  onDownloadComplete: boolean
  onImportComplete: boolean
  onImportFailed: boolean
  onUpgrade: boolean
  onHealthIssue: boolean
  includeMusic: boolean
  includeMovies: boolean
  includeTv: boolean
  includeBooks: boolean
}

interface ProviderType {
  type: string
  name: string
  fields: { name: string; label: string; type: string; required: boolean }[]
}

const defaultFormData = {
  name: '',
  type: 'discord' as const,
  enabled: true,
  settings: {} as Record<string, unknown>,
  onGrab: false,
  onDownloadComplete: true,
  onImportComplete: true,
  onImportFailed: true,
  onUpgrade: true,
  onHealthIssue: true,
  includeMusic: true,
  includeMovies: true,
  includeTv: true,
  includeBooks: true,
}

const providerIcons: Record<string, string> = {
  discord: 'Discord',
  telegram: 'Telegram',
  pushover: 'Pushover',
  slack: 'Slack',
  gotify: 'Gotify',
  email: 'Email',
}

export default function Notifications() {
  const [providers, setProviders] = useState<NotificationProvider[]>([])
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<NotificationProvider | null>(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchProviders()
    fetchProviderTypes()
  }, [])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/v1/notifications')
      if (response.ok) {
        const data = await response.json()
        setProviders(data)
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      toast.error('Failed to load notification providers')
    } finally {
      setLoading(false)
    }
  }

  const fetchProviderTypes = async () => {
    try {
      const response = await fetch('/api/v1/notifications/types')
      if (response.ok) {
        const data = await response.json()
        setProviderTypes(data)
      }
    } catch (error) {
      console.error('Failed to fetch provider types:', error)
    }
  }

  const openAddDialog = () => {
    setEditingProvider(null)
    setFormData(defaultFormData)
    setTestResult(null)
    setDialogOpen(true)
  }

  const openEditDialog = (provider: NotificationProvider) => {
    setEditingProvider(provider)
    setFormData({
      name: provider.name,
      type: provider.type,
      enabled: provider.enabled,
      settings: { ...provider.settings },
      onGrab: provider.onGrab,
      onDownloadComplete: provider.onDownloadComplete,
      onImportComplete: provider.onImportComplete,
      onImportFailed: provider.onImportFailed,
      onUpgrade: provider.onUpgrade,
      onHealthIssue: provider.onHealthIssue,
      includeMusic: provider.includeMusic,
      includeMovies: provider.includeMovies,
      includeTv: provider.includeTv,
      includeBooks: provider.includeBooks,
    })
    setTestResult(null)
    setDialogOpen(true)
  }

  const getCurrentProviderType = () => {
    return providerTypes.find((t) => t.type === formData.type)
  }

  const testConnection = async () => {
    if (!editingProvider) {
      toast.error('Save the provider first, then test')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`/api/v1/notifications/${editingProvider.id}/test`, {
        method: 'POST',
      })

      const result = await response.json()
      setTestResult(result)

      if (result.success) {
        toast.success('Test notification sent successfully!')
      } else {
        toast.error(result.error || 'Test failed')
      }
    } catch (error) {
      setTestResult({ success: false, error: 'Connection failed' })
      toast.error('Connection failed')
    } finally {
      setTesting(false)
    }
  }

  const saveProvider = async () => {
    if (!formData.name) {
      toast.error('Please enter a name')
      return
    }

    setSaving(true)

    try {
      const url = editingProvider
        ? `/api/v1/notifications/${editingProvider.id}`
        : '/api/v1/notifications'
      const method = editingProvider ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingProvider ? 'Provider updated' : 'Provider added')
        setDialogOpen(false)
        fetchProviders()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save provider')
    } finally {
      setSaving(false)
    }
  }

  const deleteProvider = async () => {
    if (!editingProvider) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/v1/notifications/${editingProvider.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Provider deleted')
        setDeleteDialogOpen(false)
        setDialogOpen(false)
        fetchProviders()
      } else {
        toast.error('Failed to delete provider')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Failed to delete provider')
    } finally {
      setDeleting(false)
    }
  }

  const renderSettingsFields = () => {
    const providerType = getCurrentProviderType()
    if (!providerType) return null

    return providerType.fields.map((field) => (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label} {field.required && '*'}
        </Label>
        <Input
          id={field.name}
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          value={(formData.settings[field.name] as string) || ''}
          onChange={(e) =>
            setFormData({
              ...formData,
              settings: { ...formData.settings, [field.name]: e.target.value },
            })
          }
          placeholder={field.label}
        />
      </div>
    ))
  }

  return (
    <AppLayout
      title="Notifications"
      actions={
        <Button onClick={openAddDialog}>
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      }
    >
      <Head title="Notifications" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Notification Providers</CardTitle>
            <CardDescription>
              Configure notification providers to receive alerts about downloads, imports, and system events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No notification providers configured.</p>
                <p className="mt-2">Add a provider to receive notifications.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {providerIcons[provider.type] || provider.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {[
                          provider.onGrab && 'Grab',
                          provider.onImportComplete && 'Import',
                          provider.onImportFailed && 'Failed',
                          provider.onUpgrade && 'Upgrade',
                          provider.onHealthIssue && 'Health',
                        ]
                          .filter(Boolean)
                          .join(', ') || 'None'}
                      </TableCell>
                      <TableCell>
                        {provider.enabled ? (
                          <Badge variant="default" className="bg-green-500">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(provider)}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Edit Notification Provider' : 'Add Notification Provider'}
            </DialogTitle>
            <DialogDescription>
              Configure your notification provider settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Discord"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    type: value as typeof formData.type,
                    settings: {},
                  })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="pushover">Pushover</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="gotify">Gotify</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectPopup>
              </Select>
            </div>

            {/* Provider-specific settings */}
            <div className="space-y-4 pt-2 border-t">
              <Label className="text-base font-medium">Provider Settings</Label>
              {renderSettingsFields()}
            </div>

            {/* Events */}
            <div className="space-y-4 pt-2 border-t">
              <Label className="text-base font-medium">Trigger on Events</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onGrab"
                    checked={formData.onGrab}
                    onCheckedChange={(checked) => setFormData({ ...formData, onGrab: !!checked })}
                  />
                  <Label htmlFor="onGrab" className="font-normal cursor-pointer">
                    On Grab
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onDownloadComplete"
                    checked={formData.onDownloadComplete}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, onDownloadComplete: !!checked })
                    }
                  />
                  <Label htmlFor="onDownloadComplete" className="font-normal cursor-pointer">
                    On Download
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onImportComplete"
                    checked={formData.onImportComplete}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, onImportComplete: !!checked })
                    }
                  />
                  <Label htmlFor="onImportComplete" className="font-normal cursor-pointer">
                    On Import
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onImportFailed"
                    checked={formData.onImportFailed}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, onImportFailed: !!checked })
                    }
                  />
                  <Label htmlFor="onImportFailed" className="font-normal cursor-pointer">
                    On Import Failed
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onUpgrade"
                    checked={formData.onUpgrade}
                    onCheckedChange={(checked) => setFormData({ ...formData, onUpgrade: !!checked })}
                  />
                  <Label htmlFor="onUpgrade" className="font-normal cursor-pointer">
                    On Upgrade
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onHealthIssue"
                    checked={formData.onHealthIssue}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, onHealthIssue: !!checked })
                    }
                  />
                  <Label htmlFor="onHealthIssue" className="font-normal cursor-pointer">
                    On Health Issue
                  </Label>
                </div>
              </div>
            </div>

            {/* Media Types */}
            <div className="space-y-4 pt-2 border-t">
              <Label className="text-base font-medium">Include Media Types</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeMusic"
                    checked={formData.includeMusic}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, includeMusic: !!checked })
                    }
                  />
                  <Label htmlFor="includeMusic" className="font-normal cursor-pointer">
                    Music
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeMovies"
                    checked={formData.includeMovies}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, includeMovies: !!checked })
                    }
                  />
                  <Label htmlFor="includeMovies" className="font-normal cursor-pointer">
                    Movies
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeTv"
                    checked={formData.includeTv}
                    onCheckedChange={(checked) => setFormData({ ...formData, includeTv: !!checked })}
                  />
                  <Label htmlFor="includeTv" className="font-normal cursor-pointer">
                    TV Shows
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeBooks"
                    checked={formData.includeBooks}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, includeBooks: !!checked })
                    }
                  />
                  <Label htmlFor="includeBooks" className="font-normal cursor-pointer">
                    Books
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: !!checked })}
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
                  {testResult.success ? 'Test notification sent!' : testResult.error || 'Test failed'}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingProvider && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="sm:mr-auto"
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {editingProvider && (
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? (
                  <Spinner className="mr-2" />
                ) : (
                  <HugeiconsIcon icon={FlashIcon} className="h-4 w-4 mr-2" />
                )}
                Test
              </Button>
            )}
            <Button onClick={saveProvider} disabled={saving}>
              {saving && <Spinner className="mr-2" />}
              {editingProvider ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {editingProvider?.name}?</DialogTitle>
            <DialogDescription>
              This will remove the notification provider. You will no longer receive notifications
              from this provider.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteProvider} disabled={deleting}>
              {deleting && <Spinner className="mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
