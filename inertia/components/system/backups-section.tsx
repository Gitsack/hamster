import { useEffect, useId, useState, type FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DatabaseAddIcon,
  DatabaseIcon,
  DatabaseRestoreIcon,
  Delete02Icon,
  Download01Icon,
  TimeScheduleIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { EntityRow } from '@/components/settings/entity-row'
import { StatusBadge } from '@/components/status-badge'
import { formatTimestamp, timeAgo } from '@/components/activity/activity_format'
import { cn } from '@/lib/utils'
import {
  RESTORE_CONFIRM_WORD,
  backupDate,
  formatBytes,
  formatInterval,
  send,
  timeUntil,
  type BackupInfo,
  type BackupList,
  type ScheduledTask,
} from './system_api'

function backupTitle(backup: BackupInfo): string {
  const date = backupDate(backup)
  if (!date) return backup.name
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const downloadUrl = (backup: BackupInfo) =>
  `/api/v1/system/backup/${encodeURIComponent(backup.name)}/download`

/**
 * Restore replaces the whole database, so it asks for the word, not a click.
 * The dialog stays open while the restore runs and reports how it ended.
 */
export function RestoreDialog({
  backup,
  onOpenChange,
}: {
  backup: BackupInfo | null
  onOpenChange: (open: boolean) => void
}) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState<'confirm' | 'restoring' | 'done'>('confirm')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (backup) {
      setTyped('')
      setPhase('confirm')
      setError(null)
    }
  }, [backup])

  const matches = typed.trim().toLowerCase() === RESTORE_CONFIRM_WORD

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!backup || !matches || phase !== 'confirm') return
    setPhase('restoring')
    setError(null)
    try {
      await send(`/api/v1/system/backup/${encodeURIComponent(backup.name)}/restore`, 'POST')
      setPhase('done')
    } catch (err) {
      setPhase('confirm')
      setError(
        `${err instanceof Error ? err.message : 'The restore failed.'} The database was left as it was.`
      )
    }
  }

  const title = backup ? backupTitle(backup) : ''

  return (
    <Dialog
      open={backup !== null}
      onOpenChange={(open) => phase !== 'restoring' && onOpenChange(open)}
    >
      <DialogContent>
        {phase === 'done' ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Database restored</DialogTitle>
              <DialogDescription>
                Everything now matches the backup from {title}. Restart Hamster so an older backup
                is migrated to this version, then reload.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Restore the backup from {title}?</DialogTitle>
              <DialogDescription>
                This replaces the whole database — settings, library, history and users — with that
                copy. Everything changed since then is lost. Create a backup first if you might want
                it back.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor={id} className="text-sm font-medium">
                Type <span className="readout">{RESTORE_CONFIRM_WORD}</span> to confirm
              </label>
              <Input
                id={id}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={phase === 'restoring'}
                aria-describedby={error ? `${id}-error` : undefined}
                className="readout"
                autoFocus
              />
              {error && (
                <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={phase === 'restoring'}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!matches || phase === 'restoring'}
                aria-busy={phase === 'restoring' || undefined}
              >
                {phase === 'restoring' ? (
                  <>
                    <Spinner className="size-4" />
                    Restoring…
                  </>
                ) : (
                  'Restore'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleRow({ task }: { task: ScheduledTask }) {
  const failed = task.enabled && task.lastStatus === 'failed'
  return (
    <EntityRow
      icon={TimeScheduleIcon}
      name="Scheduled backup"
      // Its switch, interval and Run now live with the other tasks.
      onOpen={() => {
        window.history.replaceState(window.history.state, '', '#tasks')
        document.getElementById('tasks')?.scrollIntoView({ block: 'start' })
      }}
      status={
        !task.enabled ? (
          <StatusBadge tone="paused" label="Off" />
        ) : task.isRunning ? (
          <StatusBadge tone="transit" label="Running" />
        ) : failed ? (
          <StatusBadge tone="error" label="Failed" />
        ) : task.lastRunAt ? (
          <StatusBadge tone="ok" label="OK" />
        ) : (
          <StatusBadge tone="neutral" label="Not run yet" />
        )
      }
      meta={[
        formatInterval(task.intervalMinutes),
        task.lastRunAt ? (
          <span key="last" title={formatTimestamp(task.lastRunAt)}>
            ran {timeAgo(task.lastRunAt)}
          </span>
        ) : null,
        task.enabled && task.nextRunAt ? (
          <span key="next" title={formatTimestamp(task.nextRunAt)}>
            next {timeUntil(task.nextRunAt)}
          </span>
        ) : null,
      ]}
      error={failed ? (task.lastError ?? 'The last scheduled backup failed.') : undefined}
    />
  )
}

export function BackupsSection({
  list,
  error,
  onRetry,
  backupTask,
  onChanged,
}: {
  list: BackupList | null
  error: string | null
  onRetry: () => void
  /** The scheduled backup, from the tasks list. */
  backupTask: ScheduledTask | null
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<BackupInfo | null>(null)

  const create = async () => {
    setCreating(true)
    try {
      await send('/api/v1/system/backup', 'POST')
      toast.success('Backup created')
    } catch (err) {
      toast.error('The backup was not created', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setCreating(false)
      onChanged()
    }
  }

  const remove = async (backup: BackupInfo) => {
    try {
      await send(`/api/v1/system/backup/${encodeURIComponent(backup.name)}`, 'DELETE')
      toast.success('Backup deleted')
    } catch (err) {
      toast.error('The backup was not deleted', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      onChanged()
    }
  }

  const busy = creating || Boolean(list?.running)

  return (
    <Section
      id="backups"
      title="Backups"
      description={
        list?.directory ? (
          <>
            {list.retention ? `The latest ${list.retention} are kept in ` : 'Kept in '}
            <span className="readout break-all">{list.directory}</span>
          </>
        ) : (
          'Database dumps, written on a schedule or on demand.'
        )
      }
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void create()}
          disabled={busy || !list}
          aria-busy={busy || undefined}
        >
          {busy ? (
            <Spinner className="size-4" />
          ) : (
            <HugeiconsIcon icon={DatabaseAddIcon} aria-hidden="true" />
          )}
          {busy ? 'Backing up…' : 'Create backup'}
        </Button>
      }
    >
      <RowGroup loading={!list && !error} skeletonRows={3} error={error} onRetry={onRetry}>
        {backupTask && <ScheduleRow key="schedule" task={backupTask} />}
        {list && list.backups.length === 0 && (
          <p key="empty" className="px-4 py-3 text-sm text-muted-foreground">
            No backups yet. Create one now, or wait for the scheduled run.
          </p>
        )}
        {list?.backups.map((backup) => (
          <EntityRow
            key={backup.name}
            icon={DatabaseIcon}
            name={backupTitle(backup)}
            meta={[backup.name, formatBytes(backup.size)]}
            trailing={
              <a
                href={downloadUrl(backup)}
                download={backup.name}
                aria-label={`Download the backup from ${backupTitle(backup)}`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
              >
                <HugeiconsIcon icon={Download01Icon} aria-hidden="true" />
              </a>
            }
            actions={[
              {
                label: 'Restore…',
                icon: DatabaseRestoreIcon,
                onSelect: () => setRestoring(backup),
              },
              {
                label: 'Delete',
                icon: Delete02Icon,
                destructive: true,
                onSelect: () => remove(backup),
                confirm: {
                  title: 'Delete this backup?',
                  description: `The file ${backup.name} is removed from disk.`,
                  confirmLabel: 'Delete',
                },
              },
            ]}
          />
        ))}
      </RowGroup>
      <RestoreDialog backup={restoring} onOpenChange={(open) => !open && setRestoring(null)} />
    </Section>
  )
}
