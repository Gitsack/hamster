import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { saveErrorMessage } from './setting-row'

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * A local draft of a group of field rows, compared against what the server
 * last returned. Feeds SaveBar.
 *
 * When `saved` changes (the first load, or a refetch) the draft follows it —
 * unless the operator has unsaved edits, which are kept.
 */
export function useFormDraft<T extends Record<string, unknown>>(saved: T) {
  const [baseline, setBaseline] = useState<T>(saved)
  const [draft, setDraft] = useState<T>(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = !sameValue(draft, baseline)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  useEffect(() => {
    setBaseline(saved)
    if (!dirtyRef.current) setDraft(saved)
    // Compare by content: callers often rebuild `saved` on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(saved)])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setError(null)
  }, [])

  const discard = useCallback(() => {
    setDraft(baseline)
    setError(null)
  }, [baseline])

  /** Persist the draft. Resolves true on success; on failure the error is kept for the bar. */
  const save = useCallback(
    async (persist: (draft: T) => unknown) => {
      setSaving(true)
      setError(null)
      const snapshot = draft
      try {
        await persist(snapshot)
        // What was sent is now what is stored. Anything typed while the request
        // was in flight stays in the draft and keeps the bar up. If the server
        // normalises values, refetch: an unedited draft follows `saved`.
        setBaseline(snapshot)
        return true
      } catch (err) {
        setError(saveErrorMessage(err))
        return false
      } finally {
        setSaving(false)
      }
    },
    [draft]
  )

  return { draft, set, dirty, discard, save, saving, error }
}

interface SaveBarProps {
  /** Show the bar. It stays while saving or showing an error. */
  dirty: boolean
  saving?: boolean
  /** Why the last save failed. */
  error?: ReactNode
  onSave: () => void
  onDiscard: () => void
  /** Defaults to "Unsaved changes". */
  message?: ReactNode
  saveLabel?: string
  className?: string
}

/**
 * The sticky "Unsaved changes · Discard · Save" bar for field rows, which never
 * auto-save. Put it last on the page so it can stick to the bottom of the
 * scroll area; it clears the audio player via `--player-offset`.
 *
 * While dirty it guards against closing the tab, and ⌘/Ctrl+S saves.
 */
export function SaveBar({
  dirty,
  saving = false,
  error,
  onSave,
  onDiscard,
  message = 'Unsaved changes',
  saveLabel = 'Save',
  className,
}: SaveBarProps) {
  const visible = dirty || saving
  const latest = useRef({ onSave, saving })
  latest.current = { onSave, saving }

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Legacy browsers need a returnValue to show the prompt.
      event.returnValue = ''
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!latest.current.saving) latest.current.onSave()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dirty])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      data-slot="save-bar"
      className={cn(
        'sticky bottom-[calc(var(--player-offset,0px)+1rem)] z-30',
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-popover px-4 py-2 text-popover-foreground shadow-lg',
        'motion-safe:animate-[save-bar-in_200ms_cubic-bezier(0.16,1,0.3,1)]',
        className
      )}
    >
      <div className="min-w-0" aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-sm font-medium">{message}</p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  )
}
