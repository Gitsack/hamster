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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
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
  Delete02Icon,
  Add01Icon,
  Edit02Icon,
  CheckmarkCircle02Icon,
  Alert02Icon,
  Satellite01Icon,
} from '@hugeicons/core-free-icons'
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

  // Delete confirmation state
  const [deleteIndexerId, setDeleteIndexerId] = useState<number | null>(null)

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
      toast.error('Indexer settings could not be loaded — Hamster is unreachable. Reload to retry.')
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
      toast.error('Enter the indexer URL and API key before testing.')
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
        toast.success('Indexer responded — the URL and API key work.')
      } else {
        toast.error(
          result.error ||
            'The indexer rejected the request. Check the API key is current and not rate-limited.'
        )
      }
    } catch (error) {
      toast.error(
        'Could not reach the indexer. Check the URL and that this box can resolve and reach that host.'
      )
    } finally {
      setTesting(false)
    }
  }

  const handleSaveIndexer = async () => {
    if (!indexerName.trim() || !indexerUrl.trim() || !indexerApiKey.trim()) {
      toast.error('Name, URL and API key are all required before an indexer can be saved.')
      return
    }

    setSaving(true)
    try {
      const method = editingIndexer ? 'PUT' : 'POST'
      const url = editingIndexer ? `/api/v1/indexers/${editingIndexer.id}` : '/api/v1/indexers'

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
        toast.error(
          error.error || 'Indexer not saved — the server rejected it. Check the URL and API key.'
        )
      }
    } catch (error) {
      toast.error('Indexer not saved — Hamster is unreachable. Check the server and try again.')
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
        toast.error('Indexer not deleted — the server rejected the request. Try again.')
      }
    } catch (error) {
      toast.error('Indexer not deleted — Hamster is unreachable. Check the server and try again.')
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
      toast.error(
        `${indexer.name} was not switched ${indexer.enabled ? 'off' : 'on'} — Hamster is unreachable. Try again.`
      )
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
      toast.error('Enter the Prowlarr URL and API key before testing.')
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
        toast.error(
          result.error ||
            'Prowlarr rejected the request. Check the API key under Settings → General.'
        )
      }
    } catch (error) {
      toast.error(
        'Could not reach Prowlarr. Check the URL and that this box can reach that host and port.'
      )
    } finally {
      setTesting(false)
    }
  }

  const handleSaveProwlarr = async () => {
    if (!prowlarrUrl.trim() || !prowlarrApiKey.trim()) {
      toast.error('Enter the Prowlarr URL and API key before saving.')
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
        toast.error(
          'Prowlarr settings not saved — the server rejected them. Check the URL and API key.'
        )
      }
    } catch (error) {
      toast.error(
        'Prowlarr settings not saved — Hamster is unreachable. Check the server and try again.'
      )
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle>Prowlarr</CardTitle>
                <CardDescription>
                  One connection that syncs every indexer Prowlarr manages, instead of adding them
                  here one at a time.
                </CardDescription>
              </div>
              <Button onClick={openProwlarrDialog} className="sm:shrink-0">
                {prowlarr?.configured ? 'Edit connection' : 'Connect'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ) : prowlarr?.configured ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="readout truncate text-sm">{prowlarr.url}</span>
                {prowlarr.enabled ? (
                  <Badge className="border-transparent bg-status-complete text-white">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                    Syncing
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <HugeiconsIcon icon={Alert02Icon} />
                    Paused
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not connected. Add a Prowlarr URL and API key and its indexers appear here
                automatically — otherwise add each indexer by hand below.
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
                  className="readout"
                />
                <p className="text-xs text-muted-foreground">
                  Reachable from this box. Behind Docker that is usually the container name, not
                  localhost.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prowlarr-apikey">API Key</Label>
                <Input
                  id="prowlarr-apikey"
                  type="password"
                  placeholder="Your Prowlarr API key"
                  value={prowlarrApiKey}
                  onChange={(e) => setProwlarrApiKey(e.target.value)}
                  className="readout"
                />
                <p className="text-xs text-muted-foreground">
                  Prowlarr → Settings → General → API Key.
                </p>
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-4">
                <Switch
                  id="prowlarr-enabled"
                  checked={prowlarrEnabled}
                  onCheckedChange={setProwlarrEnabled}
                />
                <Label htmlFor="prowlarr-enabled" className="cursor-pointer font-normal">
                  Sync indexers from this Prowlarr
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleTestProwlarr} disabled={testing}>
                {testing && <Spinner />}
                Test
              </Button>
              <Button onClick={handleSaveProwlarr} disabled={saving}>
                {saving && <Spinner />}
                Save
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
                  className="readout"
                />
                <p className="text-xs text-muted-foreground">
                  The site root, without the /api path — Hamster appends it.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="indexer-apikey">API Key</Label>
                <Input
                  id="indexer-apikey"
                  type="password"
                  placeholder="Your indexer API key"
                  value={indexerApiKey}
                  onChange={(e) => setIndexerApiKey(e.target.value)}
                  className="readout"
                />
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-4">
                <Switch
                  id="indexer-enabled"
                  checked={indexerEnabled}
                  onCheckedChange={setIndexerEnabled}
                />
                <Label htmlFor="indexer-enabled" className="cursor-pointer font-normal">
                  Search this indexer
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleTestIndexer} disabled={testing}>
                {testing && <Spinner />}
                Test
              </Button>
              <Button onClick={handleSaveIndexer} disabled={saving}>
                {saving && <Spinner />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Direct Indexers */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle>Direct indexers</CardTitle>
                <CardDescription>
                  Newznab-compatible indexers Hamster queries itself. Switch one off to keep it
                  configured but out of every search.
                </CardDescription>
              </div>
              <Button onClick={() => openIndexerDialog()} className="sm:shrink-0">
                <HugeiconsIcon icon={Add01Icon} />
                Add indexer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-9 rounded-full" />
                  </div>
                ))}
              </div>
            ) : indexers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <HugeiconsIcon
                    icon={Satellite01Icon}
                    className="size-6 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-medium">No indexers yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Hamster has nowhere to search for releases. Add a Newznab indexer, or connect
                  Prowlarr above to pull them in automatically.
                </p>
                <Button variant="outline" onClick={() => openIndexerDialog()}>
                  <HugeiconsIcon icon={Add01Icon} />
                  Add indexer
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-20">Searched</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indexers.map((indexer) => (
                    <TableRow key={indexer.id}>
                      <TableCell className="font-medium">{indexer.name}</TableCell>
                      <TableCell className="readout max-w-[24rem] truncate text-muted-foreground">
                        {indexer.url}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={indexer.enabled}
                          aria-label={`Search ${indexer.name}`}
                          onCheckedChange={() => handleToggleIndexer(indexer)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${indexer.name}`}
                            onClick={() => openIndexerDialog(indexer)}
                          >
                            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${indexer.name}`}
                            onClick={() => setDeleteIndexerId(indexer.id)}
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

      {/* Delete confirmation */}
      <AlertDialog open={deleteIndexerId !== null} onOpenChange={() => setDeleteIndexerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete indexer?</AlertDialogTitle>
            <AlertDialogDescription>
              The indexer and its API key are removed and future searches will skip it. Releases
              already grabbed are unaffected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteIndexerId) {
                  handleDeleteIndexer(deleteIndexerId)
                  setDeleteIndexerId(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
