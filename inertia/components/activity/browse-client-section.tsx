import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@inertiajs/react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowUp01Icon,
  ComputerIcon,
  File01Icon,
  FileImportIcon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Section } from '@/components/settings/section'
import { RowGroup, describeHttpError } from '@/components/settings/row-group'
import { ActivityRow, RowButton } from './activity-row'
import { formatSize, formatTimestamp, readResponseError, timeAgo } from './activity_format'

interface DownloadClientSummary {
  id: string | number
  name: string
  type: string
  enabled: boolean
  localPath: string | null
}

interface BrowseItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string | null
}

interface BrowseListing {
  path: string
  canGoUp: boolean
  parentPath: string
  items: BrowseItem[]
}

const CLIENT_TYPE_LABELS: Record<string, string> = {
  sabnzbd: 'SABnzbd',
  nzbget: 'NZBGet',
  qbittorrent: 'qBittorrent',
  transmission: 'Transmission',
}

/**
 * Browse a download client's completed folder: import a finished download by
 * hand, or save it to this computer. Moved here from Settings → Download
 * clients, whose rows now link to `/activity/imports?client=:id`.
 */
export function BrowseClientSection({
  clientParam,
  onClientChange,
  isAdmin,
}: {
  clientParam: string | null
  onClientChange: (clientId: string) => void
  /** Importing writes to the library, which the API keeps to admins. */
  isAdmin: boolean
}) {
  const [clients, setClients] = useState<DownloadClientSummary[] | null>(null)
  const [clientsError, setClientsError] = useState<string | null>(null)

  const [listing, setListing] = useState<BrowseListing | null>(null)
  const [listingError, setListingError] = useState<string | null>(null)
  const [listingLoading, setListingLoading] = useState(false)
  const [importingPath, setImportingPath] = useState<string | null>(null)

  const loadClients = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/downloadclients')
      if (!response.ok) throw new Error(describeHttpError(response))
      setClients((await response.json()) as DownloadClientSummary[])
      setClientsError(null)
    } catch (error) {
      setClientsError(error instanceof Error ? error.message : 'The server did not answer')
    }
  }, [])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  const browsable = (clients ?? []).filter((c) => Boolean(c.localPath))
  // The link from Settings names a client; with only one that can be browsed, open it.
  const selectedId = clientParam ?? (browsable.length === 1 ? String(browsable[0].id) : null)
  const selected = clients?.find((c) => String(c.id) === selectedId) ?? null

  const browse = useCallback(async (client: DownloadClientSummary, path?: string) => {
    setListingLoading(true)
    setListingError(null)
    try {
      const url = path
        ? `/api/v1/downloadclients/${client.id}/browse?path=${encodeURIComponent(path)}`
        : `/api/v1/downloadclients/${client.id}/browse`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(
          await readResponseError(
            response,
            `${describeHttpError(response)}. Check the local path mapping points at a directory Hamster can read.`
          )
        )
      }
      const data = await response.json()
      setListing({
        path: data.path,
        canGoUp: Boolean(data.canGoUp),
        parentPath: data.parentPath,
        items: data.items ?? [],
      })
    } catch (error) {
      setListing(null)
      setListingError(error instanceof Error ? error.message : 'The folder could not be listed')
    } finally {
      setListingLoading(false)
    }
  }, [])

  // Open the selected client's folder whenever the selection changes.
  const selectedKey = selected?.localPath ? String(selected.id) : null
  useEffect(() => {
    if (!selected || !selected.localPath) {
      setListing(null)
      setListingError(null)
      return
    }
    void browse(selected)
    // `selected` is re-derived each render; the key is what identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, browse])

  // Arriving from a client's Browse link: bring this section into view once it has content.
  const scrolled = useRef(false)
  useEffect(() => {
    if (scrolled.current || !clientParam || clients === null) return
    scrolled.current = true
    document.getElementById('browse')?.scrollIntoView({ block: 'start' })
  }, [clientParam, clients])

  const importPath = async (item: BrowseItem) => {
    if (!selected) return
    setImportingPath(item.path)
    try {
      const response = await fetch(`/api/v1/downloadclients/${selected.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success) {
        toast.success(data.message || `Imported ${data.filesImported ?? ''} files`.trim())
        if (listing) void browse(selected, listing.path)
      } else {
        toast.error(
          data.error ||
            data.errors?.[0] ||
            'Nothing was imported. Check the files are complete and that a matching title exists in the library.'
        )
      }
    } catch {
      toast.error('Import could not start: Hamster is unreachable. Try again.')
    } finally {
      setImportingPath(null)
    }
  }

  const saveToComputer = (item: BrowseItem) => {
    if (!selected) return
    const link = document.createElement('a')
    link.href = `/api/v1/downloadclients/${selected.id}/download?path=${encodeURIComponent(item.path)}`
    link.download = item.isDirectory ? `${item.name}.zip` : item.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Downloading ${link.download}`)
  }

  const settingsLink = (label: string) =>
    isAdmin ? (
      <Link
        href="/settings/download-clients"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {label}
      </Link>
    ) : (
      label
    )

  let body
  if (clientsError) {
    body = <RowGroup error={clientsError} onRetry={() => void loadClients()} />
  } else if (clients === null) {
    body = <RowGroup loading skeletonRows={2} />
  } else if (clients.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        No download clients yet. Add one in {settingsLink('Settings → Download clients')}.
      </p>
    )
  } else if (!selected) {
    body = (
      <p className="text-sm text-muted-foreground">
        {clientParam
          ? 'That download client no longer exists. Choose another one above.'
          : 'Choose a client to list its completed folder.'}
      </p>
    )
  } else if (!selected.localPath) {
    body = (
      <p className="text-sm text-muted-foreground">
        {selected.name} has no local path, so Hamster cannot read its folder. Set one in{' '}
        {settingsLink('Settings → Download clients')}.
      </p>
    )
  } else {
    body = (
      <div className="space-y-2">
        {listing && (
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!listing.canGoUp || listingLoading}
              onClick={() => void browse(selected, listing.parentPath)}
              aria-label="Up one folder"
              title="Up one folder"
            >
              <HugeiconsIcon icon={ArrowUp01Icon} aria-hidden="true" />
            </Button>
            <p
              className="readout min-w-0 truncate text-xs text-muted-foreground"
              title={listing.path}
            >
              {listing.path}
            </p>
          </div>
        )}
        <RowGroup
          loading={listingLoading && !listing}
          aria-busy={listingLoading || undefined}
          error={listingError}
          onRetry={() => void browse(selected, listing?.path)}
          empty="This folder is empty. Finished downloads appear once the client moves them out of its in-progress folder."
        >
          {(listing?.items ?? []).map((item) => (
            <ActivityRow
              key={item.path}
              title={
                item.isDirectory ? (
                  <button
                    type="button"
                    onClick={() => void browse(selected, item.path)}
                    className="readout flex max-w-full min-w-0 items-center gap-2 rounded-sm text-left outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <HugeiconsIcon
                      icon={Folder01Icon}
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{item.name}</span>
                  </button>
                ) : (
                  <span className="readout flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={File01Icon}
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                )
              }
              titleHint={item.name}
              meta={[
                item.isDirectory ? 'folder' : null,
                formatSize(item.size),
                item.modifiedAt ? (
                  <span key="t" title={formatTimestamp(item.modifiedAt)}>
                    modified {timeAgo(item.modifiedAt)}
                  </span>
                ) : null,
              ]}
              actions={
                <>
                  <RowButton
                    icon={ComputerIcon}
                    label={item.isDirectory ? 'Save as .zip' : 'Save to this computer'}
                    iconOnly
                    onClick={() => saveToComputer(item)}
                  />
                  {isAdmin && (
                    <RowButton
                      icon={FileImportIcon}
                      label="Import"
                      busy={importingPath === item.path}
                      disabled={importingPath !== null}
                      onClick={() => void importPath(item)}
                    />
                  )}
                </>
              }
            />
          ))}
        </RowGroup>
      </div>
    )
  }

  return (
    <Section
      id="browse"
      title="Browse client"
      description="Import a finished download by hand, or save it to this computer."
      actions={
        clients && clients.length > 0 ? (
          <Select value={selectedId ?? ''} onValueChange={(v) => onClientChange(String(v))}>
            <SelectTrigger size="sm" className="w-48" aria-label="Download client">
              <SelectValue>
                {(value: string) =>
                  clients.find((c) => String(c.id) === value)?.name ?? 'Choose a client'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {clients.map((client) => (
                <SelectItem key={client.id} value={String(client.id)}>
                  {client.name}
                  <span className="text-xs text-muted-foreground">
                    {CLIENT_TYPE_LABELS[client.type] ?? client.type}
                    {!client.localPath && ' · no local path'}
                  </span>
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null
      }
    >
      {body}
    </Section>
  )
}
