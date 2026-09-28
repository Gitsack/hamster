import { HugeiconsIcon } from '@hugeicons/react'
import { Refresh01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { EntityRow } from '@/components/settings/entity-row'
import { StatusBadge, type StatusTone } from '@/components/status-badge'
import { formatBytes, type FolderHealth } from '@/components/system/system_api'
import { cn } from '@/lib/utils'
import { MEDIA_TYPES, MEDIA_TYPE_INFO, type MediaType, type RootFolder } from './library_catalog'

export interface MediaTypeRowState {
  type: MediaType
  enabled: boolean
  folder: RootFolder | null
  /** The health monitor's last look at the folder: free space, low-space warning. */
  health: FolderHealth | null
  scanning: boolean
}

export interface FolderVerdict {
  tone: StatusTone
  label: string
  /** Line 3, in destructive ink. */
  error?: string
}

/**
 * One word for a type's folder. Reachability is live (the folder list checks
 * each path); space comes from the health monitor's cache, which is the only
 * place that measures it.
 */
export function folderVerdict(row: MediaTypeRowState): FolderVerdict | null {
  if (!row.enabled) return null
  if (row.scanning) return { tone: 'transit', label: 'Scanning' }
  if (!row.folder) return { tone: 'warning', label: 'No folder' }
  if (!row.folder.accessible) {
    return {
      tone: 'error',
      label: 'Unreachable',
      error: 'Hamster cannot read this path. Check the mount and its permissions.',
    }
  }
  if (row.health?.status === 'warning') return { tone: 'warning', label: 'Low space' }
  if (row.health?.status === 'error') {
    return { tone: 'error', label: 'Unreachable', error: row.health.message }
  }
  return { tone: 'ok', label: 'Readable' }
}

interface MediaTypesSectionProps {
  rows: MediaTypeRowState[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  hasTmdbKey: boolean
  onToggle: (type: MediaType, enabled: boolean) => Promise<void>
  onEditFolder: (type: MediaType) => void
  onRescan: (folder: RootFolder) => void
  onAddTmdbKey: () => void
}

/**
 * Settings → Media → Media types: which libraries this install manages, and
 * the folder each one owns. Movies and TV get their metadata from TMDB, so
 * without a key their switch is held off and the row offers the key instead.
 */
export function MediaTypesSection({
  rows,
  loading,
  error,
  onRetry,
  hasTmdbKey,
  onToggle,
  onEditFolder,
  onRescan,
  onAddTmdbKey,
}: MediaTypesSectionProps) {
  // Four fixed rows in the canonical order. Floating failures to the top would
  // make a row jump away from the switch just pressed; the badges carry it.
  const ordered = rows
    ? MEDIA_TYPES.map((type) => rows.find((row) => row.type === type)).filter(
        (row): row is MediaTypeRowState => row !== undefined
      )
    : []

  return (
    <Section
      id="types"
      title="Media types"
      description="The libraries Hamster manages, and the folder on disk each one owns."
    >
      <RowGroup loading={loading} skeletonRows={4} error={error} onRetry={onRetry}>
        {ordered.map((row) => {
          const info = MEDIA_TYPE_INFO[row.type]
          const needsKey = info.needsTmdbKey && !hasTmdbKey
          const verdict = folderVerdict(row)
          const folder = row.folder
          const free =
            row.health?.freeBytes !== null && row.health?.freeBytes !== undefined
              ? `${formatBytes(row.health.freeBytes)} free`
              : null

          let status = verdict ? <StatusBadge tone={verdict.tone} label={verdict.label} /> : null
          if (needsKey) status = <StatusBadge tone="warning" label="Needs TMDB key" />

          const meta = !row.enabled
            ? [
                <span key="about" className="font-sans">
                  {info.description}
                </span>,
              ]
            : folder
              ? [
                  <span key="path" title={folder.name ?? folder.path}>
                    {folder.path}
                  </span>,
                  free,
                ]
              : [
                  <span key="none" className="font-sans">
                    Nothing is scanned or imported until it has a folder.
                  </span>,
                ]

          const trailing = (
            <>
              {needsKey && (
                <Button type="button" variant="ghost" size="sm" onClick={onAddTmdbKey}>
                  Add key
                </Button>
              )}
              {row.enabled && folder && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rescan the ${info.noun} folder`}
                  title="Rescan: reconcile the files on disk with the library"
                  disabled={row.scanning || !folder.accessible}
                  onClick={() => onRescan(folder)}
                >
                  <HugeiconsIcon
                    icon={Refresh01Icon}
                    aria-hidden="true"
                    className={cn(
                      'size-4',
                      row.scanning && 'animate-spin motion-reduce:animate-none'
                    )}
                  />
                </Button>
              )}
              {row.enabled && !folder && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditFolder(row.type)}
                >
                  Set folder
                </Button>
              )}
            </>
          )

          return (
            <EntityRow
              key={row.type}
              icon={info.icon}
              name={info.label}
              status={status}
              meta={meta}
              error={verdict?.error}
              enabled={row.enabled}
              onEnabledChange={(next) => onToggle(row.type, next)}
              enabledLabel={`Manage ${info.noun}`}
              // Held off until there is a key; an enabled type can always be turned off.
              enabledDisabled={needsKey && !row.enabled}
              trailing={trailing}
              {...(row.enabled && folder
                ? { onOpen: () => onEditFolder(row.type) }
                : { onOpen: undefined })}
            />
          )
        })}
      </RowGroup>
    </Section>
  )
}
