import { useOperationTracker, OperationTrackerContext } from '@/hooks/use_operation_tracker'
import type { OperationGroup } from '@/hooks/use_operation_tracker'
import { Progress } from '@/components/ui/progress'
import { useState, type ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Loader2Icon } from 'lucide-react'
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
        'rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden transition-all',
        allDone && failed === 0 && 'border-green-500/50',
        allDone && failed > 0 && failed < total && 'border-yellow-500/50',
        allDone && failed === total && 'border-destructive/50'
      )}
    >
      {/* Header */}
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors"
        onClick={onToggleCollapse}
      >
        {allDone ? (
          failed === 0 ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-green-500 shrink-0" />
          ) : (
            <HugeiconsIcon icon={Cancel01Icon} className="size-4 text-yellow-500 shrink-0" />
          )
        ) : (
          <Loader2Icon className="size-4 animate-spin text-primary shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{group.label}</span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {completed}/{total}
        </span>
      </button>

      {/* Progress bar */}
      {!allDone && <Progress value={progressValue} className="h-1 rounded-none" />}

      {/* Expanded details */}
      {!collapsed && total <= 20 && (
        <div className="px-3 pb-2 max-h-40 overflow-y-auto">
          <div className="space-y-0.5">
            {group.operations.map((op) => (
              <div key={op.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                {op.status === 'pending' && (
                  <Loader2Icon className="size-3 animate-spin shrink-0" />
                )}
                {op.status === 'success' && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    className="size-3 text-green-500 shrink-0"
                  />
                )}
                {op.status === 'error' && (
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    className="size-3 text-destructive shrink-0"
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
          {succeeded > 0 && <span className="text-green-500">{succeeded} succeeded</span>}
          {failed > 0 && (
            <span className="text-destructive">
              {succeeded > 0 ? ', ' : ''}
              {failed} failed
            </span>
          )}
        </div>
      )}
    </div>
  )
}
