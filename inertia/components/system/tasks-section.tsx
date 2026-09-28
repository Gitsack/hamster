import { useEffect, useId, useState, type FormEvent } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Clock01Icon, PlayIcon, TimeScheduleIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  TASK_DESCRIPTIONS,
  formatDuration,
  formatInterval,
  send,
  sortTasks,
  taskDisplayName,
  taskState,
  timeUntil,
  type ScheduledTask,
  type TaskState,
} from './system_api'

const STATE_BADGE: Record<
  TaskState,
  { tone: 'transit' | 'error' | 'ok' | 'neutral' | 'paused'; label: string }
> = {
  running: { tone: 'transit', label: 'Running' },
  failed: { tone: 'error', label: 'Failed' },
  ok: { tone: 'ok', label: 'OK' },
  never: { tone: 'neutral', label: 'Not run yet' },
  disabled: { tone: 'paused', label: 'Disabled' },
}

function TaskRow({
  task,
  onRun,
  onToggle,
  onEditInterval,
}: {
  task: ScheduledTask
  onRun: () => void
  onToggle: (enabled: boolean) => Promise<void>
  onEditInterval: () => void
}) {
  const state = taskState(task)
  const badge = STATE_BADGE[state]
  const description = TASK_DESCRIPTIONS[task.type]

  return (
    <EntityRow
      icon={TimeScheduleIcon}
      name={taskDisplayName(task)}
      status={<StatusBadge tone={badge.tone} label={badge.label} />}
      meta={[
        formatInterval(task.intervalMinutes),
        task.lastRunAt ? (
          <span key="last" title={formatTimestamp(task.lastRunAt)}>
            ran {timeAgo(task.lastRunAt)}
          </span>
        ) : null,
        state !== 'running' ? formatDuration(task.lastDurationMs) : null,
        task.enabled && !task.isRunning && task.nextRunAt ? (
          <span key="next" title={formatTimestamp(task.nextRunAt)}>
            next {timeUntil(task.nextRunAt)}
          </span>
        ) : null,
        description ? (
          <span key="does" className="font-sans">
            {description}
          </span>
        ) : null,
      ]}
      error={
        state === 'failed'
          ? (task.lastError ?? 'The last run failed without a message.')
          : undefined
      }
      enabled={task.enabled}
      onEnabledChange={onToggle}
      enabledLabel={`Run ${taskDisplayName(task)} on schedule`}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRun}
          disabled={task.isRunning}
          aria-label={`Run ${taskDisplayName(task)} now`}
        >
          <HugeiconsIcon icon={PlayIcon} aria-hidden="true" />
          <span className="hidden sm:inline">Run now</span>
        </Button>
      }
      actions={[{ label: 'Change interval…', icon: Clock01Icon, onSelect: onEditInterval }]}
    />
  )
}

function IntervalDialog({
  task,
  onOpenChange,
  onSave,
}: {
  task: ScheduledTask | null
  onOpenChange: (open: boolean) => void
  onSave: (task: ScheduledTask, minutes: number) => Promise<void>
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setValue(String(task.intervalMinutes))
      setError(null)
      setSaving(false)
    }
  }, [task])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!task || saving) return
    const minutes = Number(value)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 43200) {
      setError('Enter whole minutes between 1 and 43200 (30 days).')
      return
    }
    setSaving(true)
    try {
      await onSave(task, minutes)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The interval was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={task !== null} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Change interval</DialogTitle>
            <DialogDescription>
              How often {task ? taskDisplayName(task) : 'this task'} runs. The next run moves to one
              interval from now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={id} className="text-sm font-medium">
              Minutes between runs
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={43200}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value)
                  if (error) setError(null)
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className="readout w-32"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">
                {Number(value) >= 1 ? formatInterval(Math.floor(Number(value))) : null}
              </span>
            </div>
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
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TasksSection({
  tasks,
  error,
  onRetry,
  onChanged,
}: {
  tasks: ScheduledTask[] | null
  error: string | null
  onRetry: () => void
  /** Refetch after a change; the page keeps polling while something runs. */
  onChanged: (next?: ScheduledTask) => void
}) {
  const [editing, setEditing] = useState<ScheduledTask | null>(null)
  const sorted = tasks ? sortTasks(tasks) : []
  const failed = sorted.filter((t) => taskState(t) === 'failed').length

  const run = async (task: ScheduledTask) => {
    try {
      await send(`/api/v1/system/tasks/${task.id}/run`, 'POST')
      toast.success(`${taskDisplayName(task)} started`)
      onChanged({ ...task, isRunning: true })
    } catch (err) {
      toast.error(`${taskDisplayName(task)} did not start`, {
        description: err instanceof Error ? err.message : undefined,
      })
      onChanged()
    }
  }

  const update = async (task: ScheduledTask, body: Partial<ScheduledTask>) => {
    const result = await send<{ task: ScheduledTask }>(
      `/api/v1/system/tasks/${task.id}`,
      'PUT',
      body
    )
    onChanged(result?.task)
  }

  return (
    <Section
      id="tasks"
      title="Tasks"
      description={
        failed > 0 ? (
          <span className="text-destructive">
            {failed === 1 ? '1 task' : `${failed} tasks`} failed on the last run.
          </span>
        ) : (
          'Background jobs Hamster runs on a schedule.'
        )
      }
    >
      <RowGroup
        loading={!tasks && !error}
        skeletonRows={6}
        error={error}
        onRetry={onRetry}
        empty="No scheduled tasks yet. They are created a few seconds after Hamster starts."
      >
        {sorted.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onRun={() => void run(task)}
            onToggle={(enabled) => update(task, { enabled })}
            onEditInterval={() => setEditing(task)}
          />
        ))}
      </RowGroup>
      <IntervalDialog
        task={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(task, intervalMinutes) => update(task, { intervalMinutes })}
      />
    </Section>
  )
}
