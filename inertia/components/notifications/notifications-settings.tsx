import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete01Icon, FlashIcon, RefreshIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { EntityRow } from '@/components/settings/entity-row'
import { StatusBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useConfirmDialog } from '@/hooks/use_confirm_dialog'
import { formatTimestamp, timeAgo } from '@/components/activity/activity_format'
import { summarizeEvents, summarizeMedia } from './event_catalog'
import { AddTargetPicker, targetIcon, type AddChoice } from './add-target-picker'
import { TargetSheet, type TargetSheetMode } from './target-sheet'
import { DeliveryLog } from './delivery-log'
import {
  clearAllDeliveries,
  deliveryProblem,
  detectPreset,
  fetchAllDeliveries,
  providerToTarget,
  requestJson,
  sortTargets,
  targetFailing,
  targetPath,
  targetUpdateBody,
  webhookToTarget,
  type Delivery,
  type ProviderRecord,
  type ProviderType,
  type Target,
  type TestResult,
  type WebhookRecord,
} from './targets'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster is unreachable.'
}

/** The add-picker choice a stored target corresponds to, for its icon. */
function choiceOf(target: Target): AddChoice {
  if (target.kind === 'provider') return { kind: 'provider', type: target.provider!.type }
  return { kind: 'webhook', preset: detectPreset(target.webhook!.url, target.name) ?? 'custom' }
}

/**
 * Notifications: every place Hamster reports to — push services and HTTP
 * endpoints in one list — and the log of what it sent them. The page wraps
 * this in the app layout; stories render it bare.
 */
export function NotificationsSettings() {
  const [providers, setProviders] = useState<ProviderRecord[] | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookRecord[] | null>(null)
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>([])
  const [targetsError, setTargetsError] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null)
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null)
  const [refreshingDeliveries, setRefreshingDeliveries] = useState(false)
  const [sheet, setSheet] = useState<{
    open: boolean
    mode: TargetSheetMode | null
    session: number
  }>({ open: false, mode: null, session: 0 })
  const confirmDialog = useConfirmDialog()

  const loadTargets = useCallback(async () => {
    try {
      const [nextProviders, nextWebhooks] = await Promise.all([
        requestJson<ProviderRecord[]>('/api/v1/notifications'),
        requestJson<WebhookRecord[]>('/api/v1/webhooks'),
      ])
      setProviders(nextProviders)
      setWebhooks(nextWebhooks)
      setTargetsError(null)
    } catch (error) {
      setTargetsError(`Targets could not be loaded: ${errorText(error)}`)
    }
  }, [])

  const loadDeliveries = useCallback(async () => {
    try {
      setDeliveries(await fetchAllDeliveries(50))
      setDeliveriesError(null)
    } catch (error) {
      setDeliveriesError(`Deliveries could not be loaded: ${errorText(error)}`)
    }
  }, [])

  const loadTypes = useCallback(async () => {
    try {
      setProviderTypes(await requestJson<ProviderType[]>('/api/v1/notifications/types'))
    } catch (error) {
      // HTTP targets can still be added; the Push group is simply empty until a reload.
      toast.error('Push services could not be listed', { description: errorText(error) })
    }
  }, [])

  useEffect(() => {
    void loadTargets()
    void loadDeliveries()
    void loadTypes()
  }, [loadTargets, loadDeliveries, loadTypes])

  const refreshAll = useCallback(() => {
    void loadTargets()
    void loadDeliveries()
  }, [loadTargets, loadDeliveries])

  const targets = useMemo(() => {
    if (!providers || !webhooks) return null
    return sortTargets([
      ...providers.map((record) => providerToTarget(record, providerTypes)),
      ...webhooks.map(webhookToTarget),
    ])
  }, [providers, webhooks, providerTypes])

  const nameOf = useCallback(
    (key: string) => targets?.find((target) => target.key === key)?.name ?? null,
    [targets]
  )

  // ---- actions ------------------------------------------------------------

  const openSheet = (mode: TargetSheetMode) =>
    setSheet((prev) => ({ open: true, mode, session: prev.session + 1 }))

  const setEnabled = async (target: Target, enabled: boolean) => {
    const body = targetUpdateBody(target, { enabled })
    if (target.kind === 'provider') {
      const record = await requestJson<ProviderRecord>(targetPath('provider', target.id), {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setProviders(
        (prev) => prev?.map((p) => (p.id === record.id ? { ...p, ...record } : p)) ?? prev
      )
    } else {
      const record = await requestJson<WebhookRecord>(targetPath('webhook', target.id), {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setWebhooks(
        (prev) => prev?.map((w) => (w.id === record.id ? { ...w, ...record } : w)) ?? prev
      )
    }
  }

  const testTarget = async (target: Target) => {
    const pending = toast.loading(`Testing ${target.name}…`)
    try {
      const result = await requestJson<TestResult>(`${targetPath(target.kind, target.id)}/test`, {
        method: 'POST',
      })
      if (result.success) {
        toast.success(
          target.kind === 'webhook'
            ? `${target.name} answered HTTP ${result.statusCode}`
            : `Test sent through ${target.name}`,
          { id: pending }
        )
      } else {
        toast.error(`${target.name} did not accept the test`, {
          id: pending,
          description: result.statusCode
            ? `HTTP ${result.statusCode}${result.error && result.error !== `HTTP ${result.statusCode}` ? ` · ${result.error}` : ''}`
            : result.error,
        })
      }
    } catch (error) {
      toast.error(`${target.name} could not be tested`, {
        id: pending,
        description: errorText(error),
      })
    } finally {
      refreshAll()
    }
  }

  const deleteTarget = async (target: Target) => {
    try {
      await requestJson(targetPath(target.kind, target.id), { method: 'DELETE' })
      toast.success(`${target.name} deleted`)
    } catch (error) {
      toast.error(`${target.name} not deleted`, { description: errorText(error) })
    } finally {
      refreshAll()
    }
  }

  const refreshDeliveries = async () => {
    setRefreshingDeliveries(true)
    await loadDeliveries()
    setRefreshingDeliveries(false)
  }

  const askClearDeliveries = () =>
    confirmDialog.confirm({
      title: 'Clear every delivery?',
      description:
        'The delivery log of every target is emptied. Targets are kept. Entries older than 30 days are pruned automatically anyway.',
      confirmLabel: 'Clear',
      loadingLabel: 'Clearing',
      onConfirm: async () => {
        try {
          await clearAllDeliveries()
          toast.success('Delivery log cleared')
        } catch (error) {
          toast.error('Delivery log not cleared', { description: errorText(error) })
        } finally {
          refreshAll()
        }
      },
    })

  // ---- render -------------------------------------------------------------

  const failing = targets?.filter(targetFailing).length ?? 0

  return (
    <>
      <SettingsPage
        title="Notifications"
        description="Push services and webhooks that hear about grabs, imports and health."
        actions={
          <AddTargetPicker
            providerTypes={providerTypes}
            onSelect={(choice) => openSheet({ kind: 'new', choice })}
          />
        }
        ready={targets !== null && deliveries !== null}
      >
        <Section
          id="targets"
          title="Targets"
          description={
            targets && targets.length > 0
              ? failing > 0
                ? `${targets.length} targets · ${failing} failing on the last delivery`
                : `${targets.length} ${targets.length === 1 ? 'target' : 'targets'}`
              : 'Where Hamster sends word that something happened.'
          }
        >
          <RowGroup
            loading={targets === null && !targetsError}
            error={targetsError}
            onRetry={() => void loadTargets()}
            empty="No targets yet, so failed imports and stalled grabs pass unnoticed. Add one above."
          >
            {(targets ?? []).map((target) => (
              <TargetRow
                key={target.key}
                target={target}
                onOpen={() => openSheet({ kind: 'edit', target })}
                onEnabledChange={(enabled) => setEnabled(target, enabled)}
                onTest={() => testTarget(target)}
                onDelete={() => deleteTarget(target)}
              />
            ))}
          </RowGroup>
        </Section>

        <Section
          id="deliveries"
          title="Deliveries"
          description="The last 50 attempts across every target, failures first."
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refreshDeliveries()}
                disabled={refreshingDeliveries}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  aria-hidden="true"
                  className={
                    refreshingDeliveries ? 'animate-spin motion-reduce:animate-none' : undefined
                  }
                />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={askClearDeliveries}
                disabled={!deliveries || deliveries.length === 0}
              >
                Clear
              </Button>
            </>
          }
        >
          <DeliveryLog
            deliveries={deliveries}
            error={deliveriesError}
            onRetry={() => void loadDeliveries()}
            targetName={nameOf}
            empty="Nothing sent yet. Every attempt lands here with its result."
            skeletonRows={4}
          />
        </Section>
      </SettingsPage>

      {sheet.mode && (
        <TargetSheet
          key={sheet.session}
          open={sheet.open}
          onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
          mode={sheet.mode}
          providerTypes={providerTypes}
          onChanged={refreshAll}
        />
      )}

      <ConfirmDialog
        state={confirmDialog.state}
        close={confirmDialog.close}
        loading={confirmDialog.loading}
        handleConfirm={confirmDialog.handleConfirm}
      />
    </>
  )
}

function TargetRow({
  target,
  onOpen,
  onEnabledChange,
  onTest,
  onDelete,
}: {
  target: Target
  onOpen: () => void
  onEnabledChange: (enabled: boolean) => Promise<void>
  onTest: () => void
  onDelete: () => void
}) {
  const last = target.lastDelivery
  const failing = targetFailing(target)

  let lastNode: ReactNode
  if (!last) {
    lastNode = 'never sent'
  } else if (last.success) {
    lastNode = (
      <span title={formatTimestamp(last.createdAt)}>
        <HugeiconsIcon
          icon={Tick02Icon}
          aria-label="Delivered"
          className="mr-0.5 inline size-3 align-[-2px] text-status-complete-ink"
        />
        {timeAgo(last.createdAt)}
      </span>
    )
  } else if (!failing) {
    // Failed while enabled, since switched off: history, not an alarm.
    lastNode = <span title={formatTimestamp(last.createdAt)}>failed {timeAgo(last.createdAt)}</span>
  }

  return (
    <EntityRow
      name={target.name}
      icon={targetIcon(choiceOf(target))}
      status={failing ? <StatusBadge tone="error" label="Failed" /> : undefined}
      // The last delivery sits right after the type so a phone, which truncates this
      // line, still shows it.
      meta={[
        target.typeLabel,
        lastNode,
        summarizeEvents(target.events),
        target.media ? summarizeMedia(target.media) : null,
      ]}
      error={
        failing && last ? (
          <span title={formatTimestamp(last.createdAt)}>
            {deliveryProblem(last)} · {timeAgo(last.createdAt)}
          </span>
        ) : undefined
      }
      enabled={target.enabled}
      onEnabledChange={onEnabledChange}
      enabledLabel={`Send through ${target.name}`}
      onOpen={onOpen}
      actions={[
        { label: 'Test', icon: FlashIcon, onSelect: onTest },
        {
          label: 'Delete',
          icon: Delete01Icon,
          destructive: true,
          onSelect: onDelete,
          confirm: {
            title: `Delete ${target.name}?`,
            description:
              target.kind === 'provider'
                ? 'The target, its stored credentials and its delivery log are removed.'
                : 'The endpoint and its delivery log are removed. A media server refreshed this way stops rescanning on import.',
            confirmLabel: 'Delete',
          },
        },
      ]}
    />
  )
}
