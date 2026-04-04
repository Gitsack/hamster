import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

export interface TrackedOperation {
  id: string
  label: string
  status: 'pending' | 'success' | 'error'
}

export interface OperationGroup {
  id: string
  label: string
  operations: TrackedOperation[]
  startedAt: number
}

type Listener = () => void

let groups: OperationGroup[] = []
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function getSnapshot(): OperationGroup[] {
  return groups
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function addGroup(group: OperationGroup) {
  groups = [...groups, group]
  emit()
}

function updateOperation(groupId: string, opId: string, status: 'success' | 'error') {
  groups = groups.map((g) =>
    g.id === groupId
      ? { ...g, operations: g.operations.map((op) => (op.id === opId ? { ...op, status } : op)) }
      : g
  )
  emit()
}

function removeGroup(groupId: string) {
  groups = groups.filter((g) => g.id !== groupId)
  emit()
}

export interface BulkOperationItem<T> {
  /** Unique key for this operation */
  id: string
  /** Label shown in the tracker */
  label: string
  /** The async work to perform — should resolve/reject */
  execute: () => Promise<T>
}

export interface BulkOperationResult<T> {
  id: string
  label: string
  status: 'success' | 'error'
  value?: T
  error?: unknown
}

/**
 * Hook for tracking groups of concurrent async operations with global UI feedback.
 *
 * Usage:
 *   const { runBulk, activeGroups } = useOperationTracker()
 *   const results = await runBulk('Requesting books', items)
 */
export function useOperationTracker() {
  const activeGroups = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const runBulk = useCallback(
    async <T>(
      groupLabel: string,
      items: BulkOperationItem<T>[]
    ): Promise<BulkOperationResult<T>[]> => {
      if (items.length === 0) return []

      const groupId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const operations: TrackedOperation[] = items.map((item) => ({
        id: item.id,
        label: item.label,
        status: 'pending' as const,
      }))

      addGroup({ id: groupId, label: groupLabel, operations, startedAt: Date.now() })

      const results = await Promise.all(
        items.map(async (item): Promise<BulkOperationResult<T>> => {
          try {
            const value = await item.execute()
            updateOperation(groupId, item.id, 'success')
            return { id: item.id, label: item.label, status: 'success', value }
          } catch (error) {
            updateOperation(groupId, item.id, 'error')
            return { id: item.id, label: item.label, status: 'error', error }
          }
        })
      )

      // Auto-remove the group after a short delay so the UI can show the final state
      setTimeout(() => removeGroup(groupId), 3000)

      return results
    },
    []
  )

  return { runBulk, activeGroups }
}

export const OperationTrackerContext = createContext<ReturnType<typeof useOperationTracker> | null>(
  null
)

export function useOperationTrackerContext() {
  const ctx = useContext(OperationTrackerContext)
  if (!ctx)
    throw new Error('useOperationTrackerContext must be used within OperationTrackerProvider')
  return ctx
}
