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
  WebhookIcon,
} from '@hugeicons/core-free-icons'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface Webhook {
  id: string
  name: string
  url: string
  enabled: boolean
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  onGrab: boolean
  onDownloadComplete: boolean
  onImportComplete: boolean
  onImportFailed: boolean
  onUpgrade: boolean
  onRename: boolean
  onDelete: boolean
  onHealthIssue: boolean
  onHealthRestored: boolean
}

const defaultFormData = {
  name: '',
  url: '',
  enabled: true,
  method: 'POST' as const,
  onGrab: true,
  onDownloadComplete: true,
  onImportComplete: true,
  onImportFailed: true,
  onUpgrade: true,
  onRename: false,
  onDelete: false,
  onHealthIssue: true,
  onHealthRestored: false,
}

interface TemplateField {
  name: string
  label: string
  type: 'text' | 'password' | 'url' | 'number'
  placeholder: string
  help?: string
  required?: boolean
}

interface WebhookTemplate {
  id: string
  name: string
  description: string
  fields: TemplateField[]
  buildUrl: (values: Record<string, string>) => string
  formData: Partial<typeof defaultFormData>
}

const webhookTemplates: WebhookTemplate[] = [
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    description: 'Trigger library scan when media is imported',
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://localhost:8096',
        required: true,
      },
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Your Jellyfin API key',
        help: 'Dashboard → API Keys → Create',
        required: true,
      },
    ],
    buildUrl: (values) =>
      `${values.serverUrl?.replace(/\/$/, '')}/Library/Refresh?api_key=${values.apiKey}`,
    formData: {
      name: 'Jellyfin Library Refresh',
      method: 'POST',
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: true,
      onImportFailed: false,
      onUpgrade: true,
      onRename: false,
      onDelete: true,
      onHealthIssue: false,
      onHealthRestored: false,
    },
  },
  {
    id: 'plex',
    name: 'Plex',
    description: 'Trigger library scan when media is imported',
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://localhost:32400',
        required: true,
      },
      {
        name: 'token',
        label: 'Plex Token',
        type: 'password',
        placeholder: 'Your X-Plex-Token',
        help: 'Find in Plex URL after signing in: ...?X-Plex-Token=xxx',
        required: true,
      },
      {
        name: 'sectionId',
        label: 'Library Section ID',
        type: 'text',
        placeholder: '1',
        help: 'Library section number (leave empty to scan all)',
        required: false,
      },
    ],
    buildUrl: (values) => {
      const base = values.serverUrl?.replace(/\/$/, '')
      const section = values.sectionId || 'all'
      return `${base}/library/sections/${section}/refresh?X-Plex-Token=${values.token}`
    },
    formData: {
      name: 'Plex Library Refresh',
      method: 'GET',
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: true,
      onImportFailed: false,
      onUpgrade: true,
      onRename: false,
      onDelete: true,
      onHealthIssue: false,
      onHealthRestored: false,
    },
  },
  {
    id: 'emby',
    name: 'Emby',
    description: 'Trigger library scan when media is imported',
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://localhost:8096',
        required: true,
      },
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Your Emby API key',
        help: 'Dashboard → Advanced → API Keys',
        required: true,
      },
    ],
    buildUrl: (values) =>
      `${values.serverUrl?.replace(/\/$/, '')}/Library/Refresh?api_key=${values.apiKey}`,
    formData: {
      name: 'Emby Library Refresh',
      method: 'POST',
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: true,
      onImportFailed: false,
      onUpgrade: true,
      onRename: false,
      onDelete: true,
      onHealthIssue: false,
      onHealthRestored: false,
    },
  },
  {
    id: 'kodi',
    name: 'Kodi',
    description: 'Update Kodi library via JSON-RPC',
    fields: [
      {
        name: 'serverUrl',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://localhost:8080',
        help: 'Enable "Allow remote control via HTTP" in Kodi',
        required: true,
      },
    ],
    buildUrl: (values) => `${values.serverUrl?.replace(/\/$/, '')}/jsonrpc`,
    formData: {
      name: 'Kodi Library Update',
      method: 'POST',
      onGrab: false,
      onDownloadComplete: false,
      onImportComplete: true,
      onImportFailed: false,
      onUpgrade: true,
      onRename: false,
      onDelete: true,
      onHealthIssue: false,
      onHealthRestored: false,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Create a custom webhook with your own settings',
    fields: [
      {
        name: 'url',
        label: 'Webhook URL',
        type: 'url',
        placeholder: 'https://example.com/webhook',
        required: true,
      },
    ],
    buildUrl: (values) => values.url || '',
    formData: defaultFormData,
  },
]

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<WebhookTemplate | null>(null)
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    statusCode?: number
    error?: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/api/v1/webhooks')
      if (response.ok) {
        const data = await response.json()
        setWebhooks(data)
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error)
      toast.error('Webhooks could not be loaded — Hamster is unreachable. Reload to retry.')
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingWebhook(null)
    setSelectedTemplate(null)
    setFormData(defaultFormData)
    setTestResult(null)
    setTemplateDialogOpen(true)
  }

  const selectTemplate = (template: WebhookTemplate) => {
    setSelectedTemplate(template)
    setTemplateFields({})
    setFormData({
      ...defaultFormData,
      ...template.formData,
      url: '',
    })
    setTemplateDialogOpen(false)
    setDialogOpen(true)
  }

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook)
    setSelectedTemplate(null)
    setFormData({
      name: webhook.name,
      url: webhook.url,
      enabled: webhook.enabled,
      method: webhook.method,
      onGrab: webhook.onGrab,
      onDownloadComplete: webhook.onDownloadComplete,
      onImportComplete: webhook.onImportComplete,
      onImportFailed: webhook.onImportFailed,
      onUpgrade: webhook.onUpgrade,
      onRename: webhook.onRename,
      onDelete: webhook.onDelete,
      onHealthIssue: webhook.onHealthIssue,
      onHealthRestored: webhook.onHealthRestored,
    })
    setTestResult(null)
    setDialogOpen(true)
  }

  const testWebhook = async () => {
    if (!editingWebhook) {
      toast.error('Save the webhook first — testing sends a real request to the stored URL.')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`/api/v1/webhooks/${editingWebhook.id}/test`, {
        method: 'POST',
      })

      const result = await response.json()
      setTestResult(result)

      if (result.success) {
        toast.success(`Webhook responded with ${result.statusCode}`)
      } else {
        toast.error(
          result.error ||
            'The endpoint rejected the test. Check the URL, method and any token in the query string.'
        )
      }
    } catch (error) {
      setTestResult({
        success: false,
        error:
          'Hamster could not reach the endpoint. Check the host is up and reachable from here.',
      })
      toast.error(
        'Hamster could not reach the endpoint. Check the host is up and reachable from here.'
      )
    } finally {
      setTesting(false)
    }
  }

  const saveWebhook = async () => {
    // Build URL from template fields if using a template (and not editing)
    let finalUrl = formData.url
    if (selectedTemplate && !editingWebhook) {
      // Validate required template fields
      const missingFields = selectedTemplate.fields
        .filter((f) => f.required && !templateFields[f.name])
        .map((f) => f.label)

      if (missingFields.length > 0) {
        toast.error(`Still required before saving: ${missingFields.join(', ')}.`)
        return
      }

      finalUrl = selectedTemplate.buildUrl(templateFields)
    }

    if (!formData.name || !finalUrl) {
      toast.error('A name and a URL are both required before a webhook can be saved.')
      return
    }

    // Validate URL
    try {
      new URL(finalUrl)
    } catch {
      toast.error('That URL is not valid. Include the scheme, for example http://localhost:8096.')
      return
    }

    setSaving(true)

    try {
      const url = editingWebhook ? `/api/v1/webhooks/${editingWebhook.id}` : '/api/v1/webhooks'
      const method = editingWebhook ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, url: finalUrl }),
      })

      if (response.ok) {
        toast.success(editingWebhook ? 'Webhook updated' : 'Webhook added')
        setDialogOpen(false)
        fetchWebhooks()
      } else {
        const error = await response.json()
        toast.error(
          error.error || 'Webhook not saved — the server rejected it. Check the URL and method.'
        )
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Webhook not saved — Hamster is unreachable. Check the server and try again.')
    } finally {
      setSaving(false)
    }
  }

  const deleteWebhook = async () => {
    if (!editingWebhook) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/v1/webhooks/${editingWebhook.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Webhook deleted')
        setDeleteDialogOpen(false)
        setDialogOpen(false)
        fetchWebhooks()
      } else {
        toast.error('Webhook not deleted — the server rejected the request. Try again.')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Webhook not deleted — Hamster is unreachable. Check the server and try again.')
    } finally {
      setDeleting(false)
    }
  }

  const countEnabledEvents = (webhook: Webhook) => {
    return [
      webhook.onGrab,
      webhook.onDownloadComplete,
      webhook.onImportComplete,
      webhook.onImportFailed,
      webhook.onUpgrade,
      webhook.onRename,
      webhook.onDelete,
      webhook.onHealthIssue,
      webhook.onHealthRestored,
    ].filter(Boolean).length
  }

  return (
    <AppLayout
      title="Webhooks"
      actions={
        <Button onClick={openAddDialog}>
          <HugeiconsIcon icon={Add01Icon} />
          Add webhook
        </Button>
      }
    >
      <Head title="Webhooks" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
            <CardDescription>
              URLs Hamster calls when something happens in the library — a grab, an import, a health
              change. Each one gets a JSON body describing the event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : webhooks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <HugeiconsIcon
                    icon={WebhookIcon}
                    className="size-6 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-medium">No webhooks yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Nothing outside Hamster is being told when media lands. Add one to make Plex,
                  Jellyfin or Emby rescan the moment an import finishes.
                </p>
                <Button variant="outline" onClick={openAddDialog}>
                  <HugeiconsIcon icon={Add01Icon} />
                  Add webhook
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-28">Events</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell className="readout max-w-[16rem] truncate text-muted-foreground">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <span className="readout">{countEnabledEvents(webhook)}</span> events
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {webhook.enabled ? (
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
                          aria-label={`Edit ${webhook.name}`}
                          onClick={() => openEditDialog(webhook)}
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

        {/* Usage Info */}
        <Card>
          <CardHeader>
            <CardTitle>Payload shape</CardTitle>
            <CardDescription>
              What every endpoint receives. The body is the same for all event types; only{' '}
              <code className="readout">eventType</code> and the media block change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="readout overflow-x-auto rounded-md border border-border bg-muted p-4 text-xs">
              {JSON.stringify(
                {
                  eventType: 'import.completed',
                  instanceName: 'Hamster',
                  media: {
                    id: '123',
                    title: 'Movie Title',
                    year: 2024,
                    mediaType: 'movies',
                  },
                  files: [
                    {
                      path: '/media/movies/Movie Title (2024)/Movie Title (2024).mkv',
                      quality: '1080p',
                    },
                  ],
                },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Add Webhook'}</DialogTitle>
            <DialogDescription>
              Where to send the call, and which library events should trigger it.
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
                  placeholder="Plex Refresh"
                />
              </div>

              {/* Template fields for new webhooks, URL field for editing */}
              {selectedTemplate && !editingWebhook ? (
                <>
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.name} className="space-y-2">
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required && ' *'}
                      </Label>
                      <Input
                        id={field.name}
                        type={field.type === 'password' ? 'password' : 'text'}
                        value={templateFields[field.name] || ''}
                        onChange={(e) =>
                          setTemplateFields({ ...templateFields, [field.name]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        className="readout"
                      />
                      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="url">URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com/webhook"
                    className="readout"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be reachable from this box, not from your browser.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="method">HTTP Method</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, method: value as typeof formData.method })
                  }
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectPopup>
                </Select>
              </div>
            </div>

            {/* Events */}
            <fieldset className="space-y-3 border-t border-border pt-6">
              <legend className="sr-only">Trigger on events</legend>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Trigger on events</h3>
                <p className="text-xs text-muted-foreground">
                  Every ticked event fires one request. Leave them all off and the webhook stays
                  silent.
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
                    id="onRename"
                    checked={formData.onRename}
                    onCheckedChange={(checked) => setFormData({ ...formData, onRename: !!checked })}
                  />
                  <Label htmlFor="onRename" className="font-normal cursor-pointer">
                    On Rename
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onDelete"
                    checked={formData.onDelete}
                    onCheckedChange={(checked) => setFormData({ ...formData, onDelete: !!checked })}
                  />
                  <Label htmlFor="onDelete" className="font-normal cursor-pointer">
                    On Delete
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onHealthRestored"
                    checked={formData.onHealthRestored}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, onHealthRestored: !!checked })
                    }
                  />
                  <Label htmlFor="onHealthRestored" className="font-normal cursor-pointer">
                    On Health Restored
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
                Send to this endpoint
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
                  {testResult.success ? (
                    <>
                      Endpoint answered <span className="readout">{testResult.statusCode}</span>.
                      Events will be delivered.
                    </>
                  ) : (
                    testResult.error ||
                    'The endpoint did not answer. Check the URL and that the host is reachable from this box.'
                  )}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {editingWebhook && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="sm:mr-auto"
              >
                <HugeiconsIcon icon={Delete01Icon} />
                Delete
              </Button>
            )}
            {editingWebhook && (
              <Button variant="outline" onClick={testWebhook} disabled={testing}>
                {testing ? <Spinner /> : <HugeiconsIcon icon={FlashIcon} />}
                Test
              </Button>
            )}
            <Button onClick={saveWebhook} disabled={saving}>
              {saving && <Spinner />}
              {editingWebhook ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {editingWebhook?.name}?</DialogTitle>
            <DialogDescription>
              The endpoint stops receiving events immediately — a media server wired up this way
              will no longer rescan on import. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteWebhook} disabled={deleting}>
              {deleting && <Spinner />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              A preset fills in the URL shape and the sensible event set for that server. Custom
              leaves everything to you.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-4">
            {webhookTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className="flex flex-col items-start gap-1 rounded-md border border-border p-3 text-left outline-none transition-colors duration-150 hover:border-primary hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="text-sm font-medium">{template.name}</span>
                <span className="text-xs text-muted-foreground">{template.description}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
