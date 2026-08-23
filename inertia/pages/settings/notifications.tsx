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
  Notification01Icon,
} from '@hugeicons/core-free-icons'
import { Skeleton } from '@/components/ui/skeleton'
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
      toast.error(
        'Notification providers could not be loaded — Hamster is unreachable. Reload to retry.'
      )
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
      toast.error('Save the provider first — the test sends a real message using the stored keys.')
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
        toast.success('Test message sent — check the app or channel it should have arrived in.')
      } else {
        toast.error(
          result.error ||
            'The provider rejected the message. Check the token or webhook URL is still valid.'
        )
      }
    } catch (error) {
      const message =
        'Hamster could not reach the provider. Check this box has outbound network access.'
      setTestResult({ success: false, error: message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const saveProvider = async () => {
    if (!formData.name) {
      toast.error('Give the provider a name so you can tell it apart in the list.')
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
        toast.error(
          error.error ||
            'Provider not saved — the server rejected it. Check the required fields for this type.'
        )
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Provider not saved — Hamster is unreachable. Check the server and try again.')
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
        toast.error('Provider not deleted — the server rejected the request. Try again.')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Provider not deleted — Hamster is unreachable. Check the server and try again.')
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
          type={
            field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'
          }
          value={(formData.settings[field.name] as string) || ''}
          onChange={(e) =>
            setFormData({
              ...formData,
              settings: { ...formData.settings, [field.name]: e.target.value },
            })
          }
          placeholder={field.label}
          className="readout"
        />
      </div>
    ))
  }

  return (
    <AppLayout
      title="Notifications"
      actions={
        <Button onClick={openAddDialog}>
          <HugeiconsIcon icon={Add01Icon} />
          Add provider
        </Button>
      }
    >
      <Head title="Notifications" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>
              Where Hamster sends word that a grab, an import or a health check happened. Each
              provider picks its own events and media types.
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
            ) : providers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <HugeiconsIcon
                    icon={Notification01Icon}
                    className="size-6 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-medium">No providers yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Failed imports and stalled grabs will pass unnoticed. Add Discord, Telegram,
                  Gotify or email to hear about them.
                </p>
                <Button variant="outline" onClick={openAddDialog}>
                  <HugeiconsIcon icon={Add01Icon} />
                  Add provider
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-28">Type</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
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
                      <TableCell className="text-muted-foreground">
                        {[
                          provider.onGrab && 'Grab',
                          provider.onImportComplete && 'Import',
                          provider.onImportFailed && 'Failed',
                          provider.onUpgrade && 'Upgrade',
                          provider.onHealthIssue && 'Health',
                        ]
                          .filter(Boolean)
                          .join(', ') || 'No events — nothing will be sent'}
                      </TableCell>
                      <TableCell>
                        {provider.enabled ? (
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
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${provider.name}`}
                          onClick={() => openEditDialog(provider)}
                        >
                          <HugeiconsIcon icon={Edit01Icon} className="size-4" />
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
              Which service to send through, what it should say something about, and for which media
              types.
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
                <p className="text-xs text-muted-foreground">
                  Changing the type clears the credentials below.
                </p>
              </div>
            </div>

            {/* Provider-specific settings */}
            <div className="space-y-4 border-t border-border pt-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Credentials</h3>
                <p className="text-xs text-muted-foreground">
                  Taken straight from the provider. Stored on this server and never shown again in
                  full.
                </p>
              </div>
              {renderSettingsFields()}
            </div>

            {/* Events */}
            <fieldset className="space-y-3 border-t border-border pt-6">
              <legend className="sr-only">Trigger on events</legend>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Trigger on events</h3>
                <p className="text-xs text-muted-foreground">
                  Each ticked event sends one message. Import Failed is the one worth keeping on.
                </p>
              </div>
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
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, onUpgrade: !!checked })
                    }
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
            </fieldset>

            {/* Media Types */}
            <fieldset className="space-y-3 border-t border-border pt-6">
              <legend className="sr-only">Include media types</legend>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Include media types</h3>
                <p className="text-xs text-muted-foreground">
                  Events about unticked types are dropped before this provider sees them.
                </p>
              </div>
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
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, includeTv: !!checked })
                    }
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
            </fieldset>

            <div className="flex items-center gap-2 border-t border-border pt-6">
              <Checkbox
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: !!checked })}
              />
              <Label htmlFor="enabled" className="font-normal cursor-pointer">
                Send through this provider
              </Label>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                role="status"
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  testResult.success
                    ? 'border-status-complete/40 bg-status-complete/10'
                    : 'border-destructive/40 bg-destructive/10'
                }`}
              >
                <HugeiconsIcon
                  icon={testResult.success ? CheckmarkCircle01Icon : Cancel01Icon}
                  className={`mt-0.5 size-4 shrink-0 ${
                    testResult.success ? 'text-status-complete-ink' : 'text-destructive'
                  }`}
                />
                <span className="text-foreground">
                  {testResult.success
                    ? 'Test message sent. If nothing arrived, the credentials are right but the destination is wrong.'
                    : testResult.error ||
                      'The provider did not accept the message. Check the token or webhook URL.'}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {editingProvider && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="sm:mr-auto"
              >
                <HugeiconsIcon icon={Delete01Icon} />
                Delete
              </Button>
            )}
            {editingProvider && (
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? <Spinner /> : <HugeiconsIcon icon={FlashIcon} />}
                Test
              </Button>
            )}
            <Button onClick={saveProvider} disabled={saving}>
              {saving && <Spinner />}
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
              The provider and its stored credentials are removed, and you stop hearing about failed
              imports through it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteProvider} disabled={deleting}>
              {deleting && <Spinner />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
