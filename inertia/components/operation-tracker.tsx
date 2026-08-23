import { useOperationTracker, OperationTrackerContext } from '@/hooks/use_operation_tracker'
import type { OperationGroup } from '@/hooks/use_operation_tracker'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { useState, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon, Alert02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export function OperationTrackerProvider({ children }: { children: ReactNode }) {
  const tracker = useOperationTracker()

  return (
    <OperationTrackerContext.Provider value={tracker}>
      {children}
      <OperationTrackerOverlay groups={tracker.activeGroups} />
    </OperationTrackerContext.Provider>
  )
}

function OperationTrackerOverlay({ groups }: { groups: OperationGroup[] }) {
  const [collapsed, setCollapsed] = useState(false)

  if (groups.length === 0) return null

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 w-72">
      {groups.map((group) => (
        <OperationGroupCard
          key={group.id}
          group={group}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      ))}
    </div>
  )
}

function OperationGroupCard({
  group,
  collapsed,
  onToggleCollapse,
}: {
  group: OperationGroup
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const total = group.operations.length
  const completed = group.operations.filter((op) => op.status !== 'pending').length
  const failed = group.operations.filter((op) => op.status === 'error').length
  const succeeded = group.operations.filter((op) => op.status === 'success').length
  const allDone = completed === total
  const progressValue = total > 0 ? (completed / total) * 100 : 0

  return (
    <div
      className={cn(
        // A detached overlay — one of the few surfaces that may carry a shadow.
        // The outcome is carried by the header icon, not by the frame: the status
        // ramp names media state, and this overlay is Hamster narrating its own work.
        'rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden'
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        {allDone ? (
          failed === 0 ? (
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-4 text-status-complete-ink shrink-0"
            />
          ) : (
            <HugeiconsIcon icon={Alert02Icon} className="size-4 text-status-failed-ink shrink-0" />
          )
        ) : (
          <Spinner className="size-4 text-primary shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{group.label}</span>
        <span className="readout text-xs text-muted-foreground shrink-0">
          {completed}/{total}
        </span>
      </button>

      {/* Progress bar */}
      {!allDone && (
        <Progress
          value={progressValue}
          aria-label={`${group.label} progress`}
          // Signal Violet, matching the spinner above it: this bar is the app's own
          // progress, not a media state.
          className="h-1 rounded-none [&_[data-slot=progress-indicator]]:bg-primary"
        />
      )}

      {/* Expanded details */}
      {!collapsed && total <= 20 && (
        <div className="px-3 pb-2 max-h-40 overflow-y-auto">
          <div className="space-y-0.5">
            {group.operations.map((op) => (
              <div key={op.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                {op.status === 'pending' && <Spinner className="size-3 shrink-0" />}
                {op.status === 'success' && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    className="size-3 text-status-complete-ink shrink-0"
                  />
                )}
                {op.status === 'error' && (
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    className="size-3 text-status-failed-ink shrink-0"
                  />
                )}
                <span className="truncate">{op.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary for large batches */}
      {!collapsed && total > 20 && allDone && (
        <div className="px-3 pb-2 text-xs text-muted-foreground">
          {succeeded > 0 && (
            <span className="text-status-complete-ink">
              <span className="readout">{succeeded}</span> succeeded
            </span>
          )}
          {failed > 0 && (
            <span className="text-status-failed-ink">
              {succeeded > 0 ? ', ' : ''}
              <span className="readout">{failed}</span> failed
            </span>
          )}
        </div>
      )}
    </div>
  )
}
