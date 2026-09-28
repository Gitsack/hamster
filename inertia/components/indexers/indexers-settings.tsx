import { useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  FlashIcon,
  Satellite01Icon,
  ServerStack01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { InlineAction, RowGroup } from '@/components/settings/row-group'
import { SettingRow } from '@/components/settings/setting-row'
import { EntityRow } from '@/components/settings/entity-row'
import { StatusBadge } from '@/components/status-badge'
import { clockTime, getJson, send } from '@/components/system/system_api'
import { IndexerSheet, type IndexerSheetMode } from './indexer-sheet'
import { ProwlarrSheet } from './prowlarr-sheet'
import {
  displayUrl,
  prowlarrIndexerLine,
  prowlarrState,
  type ConnectionTest,
  type Indexer,
  type ProwlarrConfig,
  type ProwlarrStatus,
} from './indexers_api'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster is unreachable.'
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * Indexers: Prowlarr, and Newznab indexers added one by one. The page wraps
 * this in the settings layout; stories render it bare.
 */
export function IndexersSettings() {
  const [indexers, setIndexers] = useState<Indexer[] | null>(null)
  const [indexersError, setIndexersError] = useState<string | null>(null)
  const [prowlarr, setProwlarr] = useState<ProwlarrConfig | null>(null)
  const [prowlarrError, setProwlarrError] = useState<string | null>(null)
  const [status, setStatus] = useState<ProwlarrStatus | null>(null)
  const [indexerSheet, setIndexerSheet] = useState<{
    open: boolean
    mode: IndexerSheetMode
    session: number
  }>({ open: false, mode: { kind: 'new' }, session: 0 })
  const [prowlarrSheetOpen, setProwlarrSheetOpen] = useState(false)
  const statusRequest = useRef(0)

  const loadIndexers = useCallback(async () => {
    try {
      setIndexers(await getJson<Indexer[]>('/api/v1/indexers'))
      setIndexersError(null)
    } catch (error) {
      setIndexersError(`Indexers could not be loaded: ${errorText(error)}`)
    }
  }, [])

  /** The live Prowlarr read. Slow when Prowlarr is, so it never holds up the page. */
  const loadStatus = useCallback(async () => {
    const id = ++statusRequest.current
    setStatus(null)
    try {
      const next = await getJson<ProwlarrStatus>('/api/v1/prowlarr/status')
      if (id === statusRequest.current) setStatus(next)
      return next
    } catch (error) {
      const failed: ProwlarrStatus = {
        configured: true,
        enabled: true,
        reachable: false,
        indexers: null,
        error: errorText(error),
        checkedAt: new Date().toISOString(),
      }
      if (id === statusRequest.current) setStatus(failed)
      return failed
    }
  }, [])

  const loadProwlarr = useCallback(async () => {
    try {
      const config = await getJson<ProwlarrConfig>('/api/v1/prowlarr')
      setProwlarr(config)
      setProwlarrError(null)
      if (config.configured && config.enabled) void loadStatus()
    } catch (error) {
      setProwlarrError(`Prowlarr settings could not be loaded: ${errorText(error)}`)
    }
  }, [loadStatus])

  useEffect(() => {
    void loadIndexers()
    void loadProwlarr()
  }, [loadIndexers, loadProwlarr])

  const openIndexer = (mode: IndexerSheetMode) =>
    setIndexerSheet((prev) => ({ open: true, mode, session: prev.session + 1 }))

  // ---- Prowlarr -------------------------------------------------------------

  const setProwlarrEnabled = async (enabled: boolean) => {
    if (!prowlarr?.configured) return
    const saved = await send<ProwlarrConfig>('/api/v1/prowlarr', 'PUT', {
      url: prowlarr.url,
      apiKey: prowlarr.apiKey,
      enabled,
    })
    setProwlarr(saved ?? { ...prowlarr, enabled })
    if (enabled) void loadStatus()
  }

  const testProwlarr = async () => {
    const pending = toast.loading('Asking Prowlarr…')
    const next = await loadStatus()
    if (next.reachable) {
      toast.success('Prowlarr answered', {
        id: pending,
        description: prowlarrIndexerLine(next) ?? undefined,
      })
    } else {
      toast.error('Prowlarr did not answer', { id: pending, description: next.error ?? undefined })
    }
  }

  // ---- Direct indexers ------------------------------------------------------

  const setIndexerEnabled = async (indexer: Indexer, enabled: boolean) => {
    const saved = await send<Indexer>(`/api/v1/indexers/${indexer.id}`, 'PUT', {
      name: indexer.name,
      url: indexer.url,
      apiKey: indexer.apiKey,
      categories: indexer.categories,
      priority: indexer.priority,
      enabled,
    })
    setIndexers(
      (prev) =>
        prev?.map((item) =>
          item.id === indexer.id ? { ...item, ...(saved ?? { enabled }) } : item
        ) ?? prev
    )
  }

  const testIndexer = async (indexer: Indexer) => {
    const pending = toast.loading(`Testing ${indexer.name}…`)
    try {
      const result = await send<ConnectionTest>('/api/v1/indexers/test', 'POST', {
        url: indexer.url,
        apiKey: indexer.apiKey,
      })
      if (result?.success) {
        toast.success(`${indexer.name} answered`, { id: pending })
      } else {
        toast.error(`${indexer.name} rejected the request`, {
          id: pending,
          description: result?.error ?? 'Check the API key is current and not rate-limited.',
        })
      }
    } catch (error) {
      toast.error(`${indexer.name} could not be tested`, {
        id: pending,
        description: errorText(error),
      })
    }
  }

  const deleteIndexer = async (indexer: Indexer) => {
    try {
      await send(`/api/v1/indexers/${indexer.id}`, 'DELETE')
      toast.success(`${indexer.name} deleted`)
    } catch (error) {
      toast.error(`${indexer.name} not deleted`, { description: errorText(error) })
    } finally {
      void loadIndexers()
    }
  }

  // ---- render ---------------------------------------------------------------

  const ready =
    (indexers !== null || indexersError !== null) && (prowlarr !== null || prowlarrError !== null)
  const prowlarrOn = Boolean(prowlarr?.configured && prowlarr.enabled)
  const enabledCount = indexers?.filter((indexer) => indexer.enabled).length ?? 0
  const nothingToSearch =
    ready && indexers !== null && prowlarr !== null && !prowlarrOn && enabledCount === 0

  let directDescription = 'Newznab indexers Hamster queries itself, alongside Prowlarr.'
  if (indexers && indexers.length > 0) {
    const off = indexers.length - enabledCount
    directDescription = [plural(indexers.length, 'indexer'), off > 0 ? `${off} off` : null]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <>
      <SettingsPage
        title="Indexers"
        description="Where Hamster searches for releases: Prowlarr, or indexers added one by one."
        actions={
          <Button size="sm" onClick={() => openIndexer({ kind: 'new' })}>
            <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
            Add indexer
          </Button>
        }
        ready={ready}
      >
        {nothingToSearch && (
          <p role="status" className="-mt-4 text-sm text-destructive">
            Nothing is searched: connect Prowlarr or switch an indexer on.
          </p>
        )}

        <Section
          id="prowlarr"
          title="Prowlarr"
          description="Searches every indexer Prowlarr manages in one request."
        >
          <RowGroup
            loading={prowlarr === null && !prowlarrError}
            skeletonRows={1}
            error={prowlarrError}
            onRetry={() => void loadProwlarr()}
          >
            {prowlarr?.configured ? (
              <ProwlarrRow
                config={prowlarr}
                status={status}
                onOpen={() => setProwlarrSheetOpen(true)}
                onEnabledChange={setProwlarrEnabled}
                onTest={() => void testProwlarr()}
              />
            ) : (
              <SettingRow
                label="Not connected"
                description="Add its URL and API key and every indexer it manages is searched."
                control={
                  <Button variant="outline" size="sm" onClick={() => setProwlarrSheetOpen(true)}>
                    Connect
                  </Button>
                }
              />
            )}
          </RowGroup>
        </Section>

        <Section id="direct" title="Direct indexers" description={directDescription}>
          <RowGroup
            loading={indexers === null && !indexersError}
            error={indexersError}
            onRetry={() => void loadIndexers()}
            empty={
              <>
                No direct indexers
                {prowlarrOn ? '; Prowlarr covers searching. ' : '. '}
                <InlineAction onClick={() => openIndexer({ kind: 'new' })}>Add one</InlineAction> to
                query a Newznab site directly.
              </>
            }
          >
            {(indexers ?? []).map((indexer) => (
              <EntityRow
                key={indexer.id}
                icon={Satellite01Icon}
                name={indexer.name}
                meta={[
                  displayUrl(indexer.url),
                  indexer.categories.length > 0
                    ? plural(indexer.categories.length, 'category', 'categories')
                    : null,
                ]}
                enabled={indexer.enabled}
                onEnabledChange={(enabled) => setIndexerEnabled(indexer, enabled)}
                enabledLabel={`Search ${indexer.name}`}
                onOpen={() => openIndexer({ kind: 'edit', indexer })}
                actions={[
                  { label: 'Test', icon: FlashIcon, onSelect: () => testIndexer(indexer) },
                  {
                    label: 'Delete',
                    icon: Delete01Icon,
                    destructive: true,
                    onSelect: () => deleteIndexer(indexer),
                    confirm: {
                      title: `Delete ${indexer.name}?`,
                      description:
                        'The indexer and its API key are removed and searches skip it. Releases already grabbed are unaffected.',
                      confirmLabel: 'Delete',
                    },
                  },
                ]}
              />
            ))}
          </RowGroup>
        </Section>
      </SettingsPage>

      <IndexerSheet
        key={indexerSheet.session}
        open={indexerSheet.open}
        mode={indexerSheet.mode}
        onOpenChange={(open) => setIndexerSheet((prev) => ({ ...prev, open }))}
        onChanged={() => void loadIndexers()}
      />
      <ProwlarrSheet
        open={prowlarrSheetOpen}
        config={prowlarr}
        onOpenChange={setProwlarrSheetOpen}
        onChanged={() => void loadProwlarr()}
      />
    </>
  )
}

function ProwlarrRow({
  config,
  status,
  onOpen,
  onEnabledChange,
  onTest,
}: {
  config: ProwlarrConfig
  status: ProwlarrStatus | null
  onOpen: () => void
  onEnabledChange: (enabled: boolean) => Promise<void>
  onTest: () => void
}) {
  const state = prowlarrState(config, status)
  const checked = status ? clockTime(status.checkedAt) : ''

  let badge = null
  if (state === 'reachable') badge = <StatusBadge status="reachable" />
  else if (state === 'unreachable') badge = <StatusBadge status="unreachable" />
  else if (state === 'empty') badge = <StatusBadge tone="warning" label="No indexers" />

  let line: string | null = null
  if (state === 'checking') line = 'checking…'
  else if (state !== 'paused' && state !== 'unreachable') line = prowlarrIndexerLine(status)

  return (
    <EntityRow
      icon={ServerStack01Icon}
      name="Prowlarr"
      status={badge}
      meta={[
        displayUrl(config.url),
        line,
        state !== 'checking' && state !== 'paused' && checked ? `checked ${checked}` : null,
      ]}
      error={state === 'unreachable' ? (status?.error ?? 'No answer') : undefined}
      enabled={config.enabled}
      onEnabledChange={onEnabledChange}
      enabledLabel="Search through Prowlarr"
      onOpen={onOpen}
      actions={[{ label: 'Test', icon: FlashIcon, onSelect: onTest }]}
    />
  )
}
