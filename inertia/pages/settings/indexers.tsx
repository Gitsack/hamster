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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, Add01Icon, Edit02Icon, CheckmarkCircle02Icon, Alert02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

interface Indexer {
  id: number
  name: string
  url: string
  apiKey: string
  categories: number[]
  enabled: boolean
  priority: number
}

interface ProwlarrConfig {
  configured: boolean
  id?: number
  url: string
  apiKey: string
  syncCategories: number[]
  enabled: boolean
}

export default function Indexers() {
  const [indexers, setIndexers] = useState<Indexer[]>([])
  const [prowlarr, setProwlarr] = useState<ProwlarrConfig | null>(null)
  const [loading, setLoading] = useState(true)

  // Indexer dialog state
  const [indexerDialogOpen, setIndexerDialogOpen] = useState(false)
  const [editingIndexer, setEditingIndexer] = useState<Indexer | null>(null)
  const [indexerName, setIndexerName] = useState('')
  const [indexerUrl, setIndexerUrl] = useState('')
  const [indexerApiKey, setIndexerApiKey] = useState('')
  const [indexerEnabled, setIndexerEnabled] = useState(true)

  // Prowlarr dialog state
  const [prowlarrDialogOpen, setProwlarrDialogOpen] = useState(false)
  const [prowlarrUrl, setProwlarrUrl] = useState('')
  const [prowlarrApiKey, setProwlarrApiKey] = useState('')
  const [prowlarrEnabled, setProwlarrEnabled] = useState(true)

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const fetchData = async () => {
    try {
      const [indexersRes, prowlarrRes] = await Promise.all([
        fetch('/api/v1/indexers'),
        fetch('/api/v1/prowlarr'),
      ])

      if (indexersRes.ok) {
        setIndexers(await indexersRes.json())
      }
      if (prowlarrRes.ok) {
        setProwlarr(await prowlarrRes.json())
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

  // Indexer handlers
  const openIndexerDialog = (indexer?: Indexer) => {
    if (indexer) {
      setEditingIndexer(indexer)
      setIndexerName(indexer.name)
      setIndexerUrl(indexer.url)
      setIndexerApiKey(indexer.apiKey)
      setIndexerEnabled(indexer.enabled)
    } else {
      setEditingIndexer(null)
      setIndexerName('')
      setIndexerUrl('')
      setIndexerApiKey('')
      setIndexerEnabled(true)
    }
    setIndexerDialogOpen(true)
  }

  const handleTestIndexer = async () => {
    if (!indexerUrl || !indexerApiKey) {
      toast.error('URL and API key are required')
      return
    }

    setTesting(true)
    try {
      const response = await fetch('/api/v1/indexers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: indexerUrl, apiKey: indexerApiKey }),
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Connection successful')
      } else {
        toast.error(result.error || 'Connection failed')
      }
    } catch (error) {
      toast.error('Test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSaveIndexer = async () => {
    if (!indexerName.trim() || !indexerUrl.trim() || !indexerApiKey.trim()) {
      toast.error('All fields are required')
      return
    }

    setSaving(true)
    try {
      const method = editingIndexer ? 'PUT' : 'POST'
      const url = editingIndexer
        ? `/api/v1/indexers/${editingIndexer.id}`
        : '/api/v1/indexers'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: indexerName,
          url: indexerUrl,
          apiKey: indexerApiKey,
          enabled: indexerEnabled,
        }),
      })

      if (response.ok) {
        toast.success(editingIndexer ? 'Indexer updated' : 'Indexer added')
        setIndexerDialogOpen(false)
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save indexer')
      }
    } catch (error) {
      toast.error('Failed to save indexer')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteIndexer = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/indexers/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Indexer deleted')
        fetchData()
      } else {
        toast.error('Failed to delete indexer')
      }
    } catch (error) {
      toast.error('Failed to delete indexer')
    }
  }

  const handleToggleIndexer = async (indexer: Indexer) => {
    try {
      const response = await fetch(`/api/v1/indexers/${indexer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...indexer, enabled: !indexer.enabled }),
      })

      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to update indexer')
    }
  }

  // Prowlarr handlers
  const openProwlarrDialog = () => {
    if (prowlarr) {
      setProwlarrUrl(prowlarr.url)
      setProwlarrApiKey(prowlarr.apiKey)
      setProwlarrEnabled(prowlarr.enabled)
    } else {
      setProwlarrUrl('')
      setProwlarrApiKey('')
      setProwlarrEnabled(true)
    }
    setProwlarrDialogOpen(true)
  }

  const handleTestProwlarr = async () => {
    if (!prowlarrUrl || !prowlarrApiKey) {
      toast.error('URL and API key are required')
      return
    }

    setTesting(true)
    try {
      const response = await fetch('/api/v1/prowlarr/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: prowlarrUrl, apiKey: prowlarrApiKey }),
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`Connected to Prowlarr ${result.version}`)
      } else {
        toast.error(result.error || 'Connection failed')
      }
    } catch (error) {
      toast.error('Test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSaveProwlarr = async () => {
    if (!prowlarrUrl.trim() || !prowlarrApiKey.trim()) {
      toast.error('URL and API key are required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/v1/prowlarr', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: prowlarrUrl,
          apiKey: prowlarrApiKey,
          enabled: prowlarrEnabled,
        }),
      })

      if (response.ok) {
        toast.success('Prowlarr settings saved')
        setProwlarrDialogOpen(false)
        fetchData()
      } else {
        toast.error('Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Indexers">
      <Head title="Indexers" />

      <div className="space-y-6">
        {/* Prowlarr Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Prowlarr Integration</CardTitle>
                <CardDescription>
                  Connect to Prowlarr for centralized indexer management
                </CardDescription>
              </div>
              <Button onClick={openProwlarrDialog}>
                {prowlarr?.configured ? 'Edit' : 'Configure'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : prowlarr?.configured ? (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{prowlarr.url}</p>
                  <div className="flex items-center gap-2">
                    {prowlarr.enabled ? (
                      <Badge variant="default" className="bg-green-600">
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mr-1 size-3" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Prowlarr is not configured. Connect to Prowlarr to automatically sync your indexers.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Prowlarr Dialog */}
        <Dialog open={prowlarrDialogOpen} onOpenChange={setProwlarrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Prowlarr Settings</DialogTitle>
              <DialogDescription>
                Connect to your Prowlarr instance for centralized indexer management.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="prowlarr-url">Prowlarr URL</Label>
                <Input
                  id="prowlarr-url"
                  placeholder="http://localhost:9696"
                  value={prowlarrUrl}
                  onChange={(e) => setProwlarrUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prowlarr-apikey">API Key</Label>
                <Input
                  id="prowlarr-apikey"
                  type="password"
                  placeholder="Your Prowlarr API key"
                  value={prowlarrApiKey}
                  onChange={(e) => setProwlarrApiKey(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="prowlarr-enabled"
                  checked={prowlarrEnabled}
                  onCheckedChange={setProwlarrEnabled}
                />
                <Label htmlFor="prowlarr-enabled">Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleTestProwlarr} disabled={testing}>
                {testing ? 'Testing...' : 'Test'}
              </Button>
              <Button onClick={handleSaveProwlarr} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Indexer Dialog */}
        <Dialog open={indexerDialogOpen} onOpenChange={setIndexerDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIndexer ? 'Edit Indexer' : 'Add Indexer'}</DialogTitle>
              <DialogDescription>
                Configure a Newznab-compatible indexer for searching releases.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="indexer-name">Name</Label>
                <Input
                  id="indexer-name"
                  placeholder="My Indexer"
                  value={indexerName}
                  onChange={(e) => setIndexerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="indexer-url">URL</Label>
                <Input
                  id="indexer-url"
                  placeholder="https://indexer.example.com"
                  value={indexerUrl}
                  onChange={(e) => setIndexerUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="indexer-apikey">API Key</Label>
                <Input
                  id="indexer-apikey"
                  type="password"
                  placeholder="Your indexer API key"
                  value={indexerApiKey}
                  onChange={(e) => setIndexerApiKey(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="indexer-enabled"
                  checked={indexerEnabled}
                  onCheckedChange={setIndexerEnabled}
                />
                <Label htmlFor="indexer-enabled">Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleTestIndexer} disabled={testing}>
                {testing ? 'Testing...' : 'Test'}
              </Button>
              <Button onClick={handleSaveIndexer} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Direct Indexers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Direct Indexers</CardTitle>
                <CardDescription>
                  Add Newznab-compatible indexers directly
                </CardDescription>
              </div>
              <Button onClick={() => openIndexerDialog()}>
                <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
                Add Indexer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : indexers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No indexers configured. Add an indexer or connect to Prowlarr.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indexers.map((indexer) => (
                    <TableRow key={indexer.id}>
                      <TableCell className="font-medium">{indexer.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {indexer.url}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={indexer.enabled}
                          onCheckedChange={() => handleToggleIndexer(indexer)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openIndexerDialog(indexer)}
                          >
                            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteIndexer(indexer.id)}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              className="size-4 text-destructive"
                            />
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
    </AppLayout>
  )
}
