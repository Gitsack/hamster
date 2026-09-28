import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  Download01Icon,
  FlashIcon,
  Folder01Icon,
  Magnet01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { InlineAction, RowGroup } from '@/components/settings/row-group'
import { EntityRow, type EntityRowAction } from '@/components/settings/entity-row'
import { StatusBadge } from '@/components/status-badge'
import {
  clockTime,
  getJson,
  send,
  type ClientHealth,
  type HealthSummary,
} from '@/components/system/system_api'
import { ClientSheet, type ClientSheetMode } from './client-sheet'
import {
  clientAddress,
  clientState,
  clientTypeInfo,
  stateRank,
  type ClientState,
  type ClientTestResult,
  type DownloadClient,
  type LiveCheck,
} from './clients'

/** How often to look for the re-check a save asked for, and for how long. */
const RECHECK_POLL_MS = 2500
const RECHECK_GIVE_UP_MS = 30_000

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster is unreachable.'
}

/**
 * Download clients: where grabs go, whether each one answers (from the health
 * monitor's cache, refreshed after an edit) and a way into its folder browser.
 * The page wraps this in the settings layout; stories render it bare.
 */
export function DownloadClientsSettings() {
  const [clients, setClients] = useState<DownloadClient[] | null>(null)
  const [clientsError, setClientsError] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [live, setLive] = useState<Record<string, LiveCheck>>({})
  const [sheet, setSheet] = useState<{ open: boolean; mode: ClientSheetMode; session: number }>({
    open: false,
    mode: { kind: 'new' },
    session: 0,
  })
  const recheck = useRef<{ from: string | null; at: number } | null>(null)
  const pollTimer = useRef<number | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(pollTimer.current)
    }
  }, [])

  const loadClients = useCallback(async () => {
    try {
      const next = await getJson<DownloadClient[]>('/api/v1/downloadclients')
      if (!mounted.current) return
      setClients(next)
      setClientsError(null)
    } catch (error) {
      if (mounted.current)
        setClientsError(`Download clients could not be loaded: ${errorText(error)}`)
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      const next = await getJson<HealthSummary>('/api/v1/system/health-summary')
      if (!mounted.current) return null
      setHealth(next)
      setHealthError(null)
      return next
    } catch (error) {
      if (mounted.current) setHealthError(errorText(error))
      return null
    }
  }, [])

  useEffect(() => {
    void loadClients()
    void loadHealth()
  }, [loadClients, loadHealth])

  /**
   * Ask the health monitor for a fresh run and follow it until it lands, so a
   * client just fixed stops showing the old failure. Live Test results give
   * way to the new check once it arrives.
   */
  const requestRecheck = useCallback(async () => {
    window.clearTimeout(pollTimer.current)
    recheck.current = { from: health?.checkedAt ?? null, at: Date.now() }
    try {
      await send('/api/v1/system/health/check', 'POST')
    } catch {
      // The next scheduled run (every minute) catches up on its own.
      recheck.current = null
      return
    }
    const poll = async () => {
      const pending = recheck.current
      if (!pending || !mounted.current) return
      const next = await loadHealth()
      if (next?.checkedAt && next.checkedAt !== pending.from && !next.checking) {
        recheck.current = null
        setLive({})
        return
      }
      if (Date.now() - pending.at > RECHECK_GIVE_UP_MS) {
        recheck.current = null
        return
      }
      pollTimer.current = window.setTimeout(() => void poll(), RECHECK_POLL_MS)
    }
    pollTimer.current = window.setTimeout(() => void poll(), RECHECK_POLL_MS)
  }, [health?.checkedAt, loadHealth])

  const healthById = useMemo(
    () => new Map<string, ClientHealth>((health?.downloadClients ?? []).map((c) => [c.id, c])),
    [health]
  )

  const rows = useMemo(() => {
    if (!clients) return null
    return clients
      .map((client, index) => ({
        client,
        index,
        state: clientState(client, healthById.get(client.id), live[client.id]),
      }))
      .sort((a, b) => stateRank(a.state) - stateRank(b.state) || a.index - b.index)
  }, [clients, healthById, live])

  const recordLive = useCallback((id: string, result: ClientTestResult) => {
    setLive((prev) => ({
      ...prev,
      [id]: { success: result.success, message: result.error ?? null, at: Date.now() },
    }))
  }, [])

  // ---- actions --------------------------------------------------------------

  const openSheet = (mode: ClientSheetMode) =>
    setSheet((prev) => ({ open: true, mode, session: prev.session + 1 }))

  const setEnabled = async (client: DownloadClient, enabled: boolean) => {
    const { id, ...body } = client
    const saved = await send<DownloadClient>(`/api/v1/downloadclients/${id}`, 'PUT', {
      ...body,
      enabled,
    })
    setClients(
      (prev) => prev?.map((c) => (c.id === id ? { ...c, ...(saved ?? { enabled }) } : c)) ?? prev
    )
    setLive((prev) => {
      const { [id]: _dropped, ...rest } = prev
      return rest
    })
    // A client switched on has never been checked by the monitor; switched off, it drops out.
    void requestRecheck()
  }

  const testClient = async (client: DownloadClient) => {
    const pending = toast.loading(`Testing ${client.name}…`)
    try {
      const result = await send<ClientTestResult>('/api/v1/downloadclients/test', 'POST', {
        type: client.type,
        host: client.host,
        port: client.port,
        apiKey: client.apiKey,
        username: client.username,
        password: client.password,
        useSsl: client.useSsl,
        urlBase: client.urlBase,
      })
      const outcome = result ?? { success: false, error: 'No answer' }
      recordLive(client.id, outcome)
      if (outcome.success) {
        toast.success(`${client.name} answered${outcome.version ? ` · v${outcome.version}` : ''}`, {
          id: pending,
        })
      } else {
        toast.error(`${client.name} did not answer`, {
          id: pending,
          description: outcome.error ?? 'Check the host, port and credentials.',
        })
      }
    } catch (error) {
      toast.error(`${client.name} could not be tested`, {
        id: pending,
        description: errorText(error),
      })
    }
  }

  const deleteClient = async (client: DownloadClient) => {
    try {
      await send(`/api/v1/downloadclients/${client.id}`, 'DELETE')
      toast.success(`${client.name} deleted`)
    } catch (error) {
      toast.error(`${client.name} not deleted`, { description: errorText(error) })
    } finally {
      void loadClients()
    }
  }

  const onSheetChanged = (id: string | null) => {
    if (id) {
      setLive((prev) => {
        const { [id]: _dropped, ...rest } = prev
        return rest
      })
    }
    void loadClients()
    void requestRecheck()
  }

  // ---- render ---------------------------------------------------------------

  const ready = clients !== null || clientsError !== null
  const unreachable = rows?.filter((row) => row.state.kind === 'unreachable').length ?? 0
  const checkedAt = clockTime(health?.checkedAt)

  let description = 'The programs Hamster hands releases to and imports finished downloads from.'
  if (rows && rows.length > 0) {
    const parts = [`${rows.length} ${rows.length === 1 ? 'client' : 'clients'}`]
    if (unreachable > 0) parts.push(`${unreachable} unreachable`)
    if (healthError) parts.push('reachability unknown')
    else if (checkedAt) parts.push(`checked ${checkedAt}`)
    description = parts.join(' · ')
  }

  return (
    <>
      <SettingsPage
        title="Download clients"
        description="The programs Hamster hands releases to and imports finished downloads from."
        actions={
          <Button size="sm" onClick={() => openSheet({ kind: 'new' })}>
            <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
            Add client
          </Button>
        }
        ready={ready}
      >
        <Section id="clients" title="Clients" description={description}>
          <RowGroup
            loading={!ready}
            error={clientsError}
            onRetry={() => void loadClients()}
            empty={
              <>
                No download clients yet, so nothing can be grabbed.{' '}
                <InlineAction onClick={() => openSheet({ kind: 'new' })}>Add one</InlineAction>:
                SABnzbd, NZBGet, qBittorrent, Transmission or Deluge.
              </>
            }
          >
            {(rows ?? []).map(({ client, state }) => (
              <ClientRow
                key={client.id}
                client={client}
                state={state}
                onOpen={() => openSheet({ kind: 'edit', client })}
                onEnabledChange={(enabled) => setEnabled(client, enabled)}
                onTest={() => testClient(client)}
                onDelete={() => deleteClient(client)}
              />
            ))}
          </RowGroup>
        </Section>
      </SettingsPage>

      <ClientSheet
        key={sheet.session}
        open={sheet.open}
        mode={sheet.mode}
        onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
        onChanged={onSheetChanged}
        onTested={recordLive}
      />
    </>
  )
}

function ClientRow({
  client,
  state,
  onOpen,
  onEnabledChange,
  onTest,
  onDelete,
}: {
  client: DownloadClient
  state: ClientState
  onOpen: () => void
  onEnabledChange: (enabled: boolean) => Promise<void>
  onTest: () => void
  onDelete: () => void
}) {
  const info = clientTypeInfo(client.type)

  let badge = null
  if (state.kind === 'reachable') badge = <StatusBadge status="reachable" />
  else if (state.kind === 'unreachable') badge = <StatusBadge status="unreachable" />
  else if (state.kind === 'mapping')
    badge = <StatusBadge tone="warning" label="Needs path mapping" />

  const actions: EntityRowAction[] = [{ label: 'Test', icon: FlashIcon, onSelect: onTest }]
  if (client.localPath) {
    // Browsing and manual import live in Activity → Imports.
    actions.push({
      label: 'Browse downloads',
      icon: Folder01Icon,
      onSelect: () => router.visit(`/activity/imports?client=${encodeURIComponent(client.id)}`),
    })
  }
  actions.push({
    label: 'Delete',
    icon: Delete01Icon,
    destructive: true,
    onSelect: onDelete,
    confirm: {
      title: `Delete ${client.name}?`,
      description:
        'Hamster stops sending grabs here and stops watching its folders. Downloads already running in the client keep going.',
      confirmLabel: 'Delete',
    },
  })

  return (
    <EntityRow
      icon={info.protocol === 'torrent' ? Magnet01Icon : Download01Icon}
      name={client.name}
      status={badge}
      // The address comes right after the type so a phone, which truncates this line, keeps it.
      meta={[
        // "qBittorrent · qBittorrent" says nothing twice.
        client.name.toLowerCase().includes(info.label.toLowerCase()) ? null : info.label,
        clientAddress(client),
        client.category ? `category ${client.category}` : null,
        state.kind === 'reachable' && state.latencyMs !== null ? `${state.latencyMs} ms` : null,
        state.kind === 'unknown' ? 'not checked yet' : null,
      ]}
      error={state.kind === 'unreachable' ? state.message : undefined}
      enabled={client.enabled}
      onEnabledChange={onEnabledChange}
      enabledLabel={`Send grabs to ${client.name}`}
      onOpen={onOpen}
      actions={actions}
    />
  )
}
