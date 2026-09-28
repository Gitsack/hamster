import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { HealthSection } from './health-section'
import { TasksSection } from './tasks-section'
import { BackupsSection } from './backups-section'
import {
  aboutLine,
  getJson,
  send,
  type BackupList,
  type HealthSummary,
  type ScheduledTask,
  type SystemInfo,
} from './system_api'

/** While a task or a re-check is running, look again this often. */
const BUSY_POLL_MS = 2_000
/** Otherwise keep the page roughly as fresh as the health monitor itself. */
const IDLE_POLL_MS = 60_000
/** A re-check that has not landed by now is reported, not waited on forever. */
const RECHECK_GIVE_UP_MS = 45_000

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster did not answer.'
}

/**
 * Settings → System: the health monitor's verdict, the scheduled tasks, the
 * database backups and one line about the running build. The page wraps this
 * in the app layout; stories render it bare.
 */
export function SystemSettings() {
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [backups, setBackups] = useState<BackupList | null>(null)
  const [backupsError, setBackupsError] = useState<string | null>(null)
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)
  /** checkedAt when Re-check was pressed; cleared once a newer result lands. */
  const [recheckFrom, setRecheckFrom] = useState<{ checkedAt: string | null; at: number } | null>(
    null
  )
  /** Bumped by every poll so the next one is armed even when nothing changed. */
  const [pollTick, setPollTick] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      const next = await getJson<HealthSummary>('/api/v1/system/health-summary')
      if (!mounted.current) return
      setHealth(next)
      setHealthError(null)
    } catch (error) {
      if (mounted.current) setHealthError(`Health could not be loaded: ${message(error)}`)
    }
  }, [])

  const loadTasks = useCallback(async () => {
    try {
      const next = await getJson<{ tasks: ScheduledTask[] }>('/api/v1/system/tasks')
      if (!mounted.current) return
      setTasks(next.tasks)
      setTasksError(null)
    } catch (error) {
      if (mounted.current) setTasksError(`Tasks could not be loaded: ${message(error)}`)
    }
  }, [])

  const loadBackups = useCallback(async () => {
    try {
      const next = await getJson<BackupList>('/api/v1/system/backup')
      if (!mounted.current) return
      setBackups(next)
      setBackupsError(null)
    } catch (error) {
      if (mounted.current) setBackupsError(`Backups could not be listed: ${message(error)}`)
    }
  }, [])

  const loadInfo = useCallback(async () => {
    try {
      const next = await getJson<SystemInfo>('/api/v1/system/info')
      if (!mounted.current) return
      setInfo(next)
      setInfoError(null)
    } catch (error) {
      if (mounted.current) setInfoError(`System details could not be loaded: ${message(error)}`)
    }
  }, [])

  useEffect(() => {
    void Promise.all([loadHealth(), loadTasks(), loadBackups(), loadInfo()])
  }, [loadHealth, loadTasks, loadBackups, loadInfo])

  // Re-check lands when checkedAt moves past the value it had when pressed.
  useEffect(() => {
    if (!recheckFrom || !health) return
    if (health.checkedAt && health.checkedAt !== recheckFrom.checkedAt && !health.checking) {
      setRecheckFrom(null)
    }
  }, [health, recheckFrom])

  const anyTaskRunning = Boolean(tasks?.some((task) => task.isRunning))
  const busy =
    anyTaskRunning ||
    recheckFrom !== null ||
    health?.level === 'starting' ||
    Boolean(health?.checking) ||
    Boolean(backups?.running)

  // Poll: quickly while something is moving, once a minute otherwise, and not
  // at all while the tab is hidden.
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setPollTick((tick) => tick + 1)
        if (document.visibilityState === 'hidden') return
        if (recheckFrom && Date.now() - recheckFrom.at > RECHECK_GIVE_UP_MS) {
          setRecheckFrom(null)
          toast.error('The re-check has not finished', {
            description: 'A service is slow to answer. The result appears here when it lands.',
          })
        }
        void loadHealth()
        void loadTasks()
        if (backups?.running) void loadBackups()
      },
      busy ? BUSY_POLL_MS : IDLE_POLL_MS
    )
    return () => window.clearTimeout(timer)
  }, [busy, pollTick, backups?.running, recheckFrom, loadHealth, loadTasks, loadBackups])

  const recheck = async () => {
    setRecheckFrom({ checkedAt: health?.checkedAt ?? null, at: Date.now() })
    try {
      await send('/api/v1/system/health/check', 'POST')
    } catch (error) {
      setRecheckFrom(null)
      toast.error('The re-check did not start', { description: message(error) })
    }
  }

  const backupTask = tasks?.find((task) => task.type === 'backup') ?? null
  const ready = health !== null || healthError !== null

  return (
    <SettingsPage
      title="System"
      description="Service health, background tasks and database backups."
      ready={ready && (tasks !== null || tasksError !== null)}
    >
      <HealthSection
        summary={health}
        error={healthError}
        onRetry={() => void loadHealth()}
        onRecheck={() => void recheck()}
        checking={recheckFrom !== null}
      />

      <TasksSection
        tasks={tasks}
        error={tasksError}
        onRetry={() => void loadTasks()}
        onChanged={(next) => {
          if (next) {
            setTasks((current) =>
              current ? current.map((task) => (task.id === next.id ? next : task)) : current
            )
          }
          void loadTasks()
          // A task that stopped failing clears the health cache's failed list.
          void loadHealth()
        }}
      />

      <BackupsSection
        list={backups}
        error={backupsError}
        onRetry={() => void loadBackups()}
        backupTask={backupTask}
        onChanged={() => {
          void loadBackups()
          void loadTasks()
        }}
      />

      <Section id="about" title="About">
        <RowGroup
          loading={!info && !infoError}
          skeletonRows={1}
          error={infoError}
          onRetry={() => void loadInfo()}
        >
          {info && (
            <p className="readout flex min-h-14 items-center px-4 py-3 text-xs break-words text-muted-foreground">
              {aboutLine(info)}
            </p>
          )}
        </RowGroup>
      </Section>
    </SettingsPage>
  )
}
