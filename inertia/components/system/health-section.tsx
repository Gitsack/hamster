import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { DatabaseIcon, Download04Icon, Folder01Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { EntityRow } from '@/components/settings/entity-row'
import { StatusBadge, sortByStatus, type StatusTone } from '@/components/status-badge'
import { formatTimestamp, mediaTypeLabel, timeAgo } from '@/components/activity/activity_format'
import { clockTime, formatBytes, type HealthStatus, type HealthSummary } from './system_api'

interface HealthRow {
  key: string
  tone: StatusTone
  node: ReactNode
}

const TONE: Record<HealthStatus, StatusTone> = { ok: 'ok', warning: 'warning', error: 'error' }

/** "down 3h", "for 12m" — how long a problem has lasted; nothing for a healthy row. */
export function lasted(status: HealthStatus, since: string | null | undefined): ReactNode {
  if (status === 'ok' || !since) return null
  const ago = timeAgo(since)
  if (!ago) return null
  const span = ago === 'just now' ? 'just now' : ago.replace(' ago', '')
  const words =
    span === 'just now'
      ? status === 'error'
        ? 'down just now'
        : 'since just now'
      : `${status === 'error' ? 'down' : 'for'} ${span}`
  return <span title={formatTimestamp(since)}>{words}</span>
}

function databaseLabel(status: HealthStatus): string {
  return status === 'ok' ? 'Connected' : status === 'warning' ? 'Slow' : 'Down'
}

function folderLabel(status: HealthStatus): string {
  return status === 'ok' ? 'Readable' : status === 'warning' ? 'Low space' : 'Unreachable'
}

/** One row per thing that can break, failures first, healthy rows quiet. */
export function healthRows(summary: HealthSummary): HealthRow[] {
  const rows: HealthRow[] = []
  const check = (name: string) => summary.checks.find((c) => c.name === name)

  const database = check('database')
  if (database) {
    rows.push({
      key: 'database',
      tone: TONE[database.status],
      node: (
        <EntityRow
          key="database"
          icon={DatabaseIcon}
          name="Database"
          status={
            <StatusBadge tone={TONE[database.status]} label={databaseLabel(database.status)} />
          }
          meta={[
            // The badge already says Connected; the meta carries the latency.
            database.status === 'ok'
              ? database.message.replace(/^Connected \((.*)\)$/, '$1')
              : null,
            lasted(database.status, database.since),
          ]}
          error={database.status === 'ok' ? undefined : database.message}
        />
      ),
    })
  }

  if (summary.downloadClients.length > 0) {
    for (const client of summary.downloadClients) {
      rows.push({
        key: `client:${client.id}`,
        tone: client.status === 'ok' ? 'ok' : 'error',
        node: (
          <EntityRow
            key={`client:${client.id}`}
            icon={Download04Icon}
            name={client.name}
            href="/settings/download-clients"
            status={<StatusBadge status={client.status === 'ok' ? 'reachable' : 'unreachable'} />}
            meta={[
              client.type,
              client.latencyMs !== null ? `${client.latencyMs} ms` : null,
              lasted(client.status, client.since),
            ]}
            error={client.status === 'error' ? client.message : undefined}
          />
        ),
      })
    }
  } else {
    const clients = check('downloadClients')
    if (clients) {
      rows.push({
        key: 'clients',
        tone: TONE[clients.status],
        node: (
          <EntityRow
            key="clients"
            icon={Download04Icon}
            name="Download clients"
            href="/settings/download-clients"
            status={
              <StatusBadge
                tone={TONE[clients.status]}
                label={clients.status === 'ok' ? 'OK' : 'None enabled'}
              />
            }
            meta={[clients.message]}
          />
        ),
      })
    }
  }

  if (summary.rootFolders.length > 0) {
    for (const folder of summary.rootFolders) {
      rows.push({
        key: `folder:${folder.id}`,
        tone: TONE[folder.status],
        node: (
          <EntityRow
            key={`folder:${folder.id}`}
            icon={Folder01Icon}
            name={<span className="readout text-sm">{folder.path}</span>}
            href="/settings/media#types"
            status={<StatusBadge tone={TONE[folder.status]} label={folderLabel(folder.status)} />}
            meta={[
              mediaTypeLabel(folder.mediaType),
              folder.freeBytes !== null ? `${formatBytes(folder.freeBytes)} free` : null,
            ]}
            error={folder.status === 'error' ? folder.message : undefined}
          />
        ),
      })
    }
  } else {
    const folders = check('rootFolders')
    if (folders) {
      rows.push({
        key: 'folders',
        tone: TONE[folders.status],
        node: (
          <EntityRow
            key="folders"
            icon={Folder01Icon}
            name="Root folders"
            href="/settings/media#types"
            status={
              <StatusBadge
                tone={TONE[folders.status]}
                label={folders.status === 'ok' ? 'OK' : 'None set'}
              />
            }
            meta={[folders.message]}
            error={folders.status === 'error' ? folders.message : undefined}
          />
        ),
      })
    }
  }

  return sortByStatus(rows, (row) => row.tone)
}

export function HealthSection({
  summary,
  error,
  onRetry,
  onRecheck,
  checking,
}: {
  summary: HealthSummary | null
  error: string | null
  onRetry: () => void
  onRecheck: () => void
  /** A re-check is running; the button waits for it. */
  checking: boolean
}) {
  const starting = summary?.level === 'starting'
  const rows = summary ? healthRows(summary) : []
  const checkedAt = summary?.checkedAt ?? null

  const description = !summary ? null : summary.stale ? (
    <span className="text-destructive">
      No check has finished since <span className="readout">{clockTime(checkedAt)}</span>. The
      monitor should run every minute; restart Hamster if this stays.
    </span>
  ) : starting ? (
    'The first check runs a few seconds after Hamster starts.'
  ) : (
    <>
      Checked{' '}
      <time
        className="readout"
        dateTime={checkedAt ?? undefined}
        title={formatTimestamp(checkedAt)}
      >
        {clockTime(checkedAt)}
      </time>
      {summary.freeBytes !== null && (
        <>
          {' · '}
          <span className="readout">{formatBytes(summary.freeBytes)}</span> free for media
        </>
      )}
    </>
  )

  return (
    <Section
      id="health"
      title="Health"
      description={description}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRecheck}
          disabled={checking || !summary}
          aria-busy={checking || undefined}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            aria-hidden="true"
            className={checking ? 'animate-spin motion-reduce:animate-none' : undefined}
          />
          {checking ? 'Checking…' : 'Re-check'}
        </Button>
      }
    >
      <RowGroup
        loading={(!summary && !error) || (starting && rows.length === 0)}
        skeletonRows={3}
        error={error}
        onRetry={onRetry}
        empty="Nothing to check yet."
      >
        {rows.map((row) => row.node)}
      </RowGroup>
    </Section>
  )
}
