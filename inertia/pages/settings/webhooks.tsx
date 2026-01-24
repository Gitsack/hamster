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
} from '@hugeicons/core-free-icons'
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
      toast.error('Failed to load webhooks')
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
      toast.error('Save the webhook first, then test')
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
        toast.error(result.error || 'Test failed')
      }
    } catch (error) {
      setTestResult({ success: false, error: 'Connection failed' })
      toast.error('Connection failed')
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
        toast.error(`Please fill in: ${missingFields.join(', ')}`)
        return
      }

      finalUrl = selectedTemplate.buildUrl(templateFields)
    }

    if (!formData.name || !finalUrl) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate URL
    try {
      new URL(finalUrl)
    } catch {
      toast.error('Please enter a valid URL')
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
        toast.error(error.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save webhook')
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
        toast.error('Failed to delete webhook')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Failed to delete webhook')
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
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      }
    >
      <Head title="Webhooks" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>
              Configure webhooks to integrate with external services like Plex, Jellyfin, or custom
              automation. Webhooks will receive JSON payloads when events occur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No webhooks configured.</p>
                <p className="mt-2">Add a webhook to integrate with external services.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{countEnabledEvents(webhook)} events</Badge>
                      </TableCell>
                      <TableCell>
                        {webhook.enabled ? (
                          <Badge variant="default" className="bg-green-500">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(webhook)}>
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

        {/* Usage Info */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Payload</CardTitle>
            <CardDescription>Example payload sent to webhooks on events</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
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
            <DialogDescription>Configure your webhook endpoint settings.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                    />
                    {field.help && <p className="text-sm text-muted-foreground">{field.help}</p>}
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
                />
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
                  {testResult.success
                    ? `Success! Server responded with ${testResult.statusCode}`
                    : testResult.error || 'Test failed'}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingWebhook && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="sm:mr-auto"
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {editingWebhook && (
              <Button variant="outline" onClick={testWebhook} disabled={testing}>
                {testing ? (
                  <Spinner className="mr-2" />
                ) : (
                  <HugeiconsIcon icon={FlashIcon} className="h-4 w-4 mr-2" />
                )}
                Test
              </Button>
            )}
            <Button onClick={saveWebhook} disabled={saving}>
              {saving && <Spinner className="mr-2" />}
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
              This will remove the webhook. External services will no longer receive events.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteWebhook} disabled={deleting}>
              {deleting && <Spinner className="mr-2" />}
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
              Choose a preset for common media servers or create a custom webhook.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {webhookTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className="flex flex-col items-start gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
              >
                <span className="font-medium">{template.name}</span>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
