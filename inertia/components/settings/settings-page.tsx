import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from './page-header'
import { useSettingsShell } from './settings_shell'

function scrollToHash(behavior: ScrollBehavior) {
  const raw = window.location.hash.slice(1)
  if (!raw) return
  let id: string
  try {
    id = decodeURIComponent(raw)
  } catch {
    id = raw
  }
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView({ block: 'start', behavior })
}

/**
 * Scrolls to `location.hash` once the page's data has arrived — not on first
 * paint, when skeletons would put the section somewhere else — and again
 * whenever the hash changes while the page is open.
 */
export function useScrollToHash(ready: boolean) {
  const done = useRef(false)

  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    // Let the rows that replaced the skeletons lay out before measuring.
    const frame = window.requestAnimationFrame(() => scrollToHash('auto'))
    return () => window.cancelAnimationFrame(frame)
  }, [ready])

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const onHashChange = () => scrollToHash(reduceMotion ? 'auto' : 'smooth')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
}

interface SettingsPageProps {
  /** Equals the settings rail label. */
  title: ReactNode
  description?: ReactNode
  /** The page's primary action. */
  actions?: ReactNode
  /**
   * False while the page's first fetch is in flight. Anchor scrolling waits for
   * it so `#section` lands on the loaded layout. Defaults to true.
   */
  ready?: boolean
  /** Sections, then an optional SaveBar last so it can stick to the bottom. */
  children: ReactNode
  className?: string
}

/**
 * The content column of a settings page: header, then flat sections 40px apart.
 */
export function SettingsPage({
  title,
  description,
  actions,
  ready = true,
  children,
  className,
}: SettingsPageProps) {
  useScrollToHash(ready)
  // In the settings shell the column starts at the sidebar; on its own it centres.
  const { inShell } = useSettingsShell()

  return (
    <div
      data-slot="settings-page"
      className={cn('w-full max-w-4xl min-w-0', !inShell && 'mx-auto', className)}
    >
      <PageHeader title={title} description={description} actions={actions} />
      <div className="space-y-10">{children}</div>
    </div>
  )
}
