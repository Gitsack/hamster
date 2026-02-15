import { useState, useCallback, useRef, useEffect } from 'react'
import type { StreamingProviderInfo } from '@/components/library/media-teaser'

type ProviderMap = Record<string, StreamingProviderInfo[]>

/**
 * Lazy-loads streaming watch providers using IntersectionObserver.
 * Only fetches providers for teasers that become visible, batching requests
 * with a short debounce to minimize API calls.
 */
export function useVisibleWatchProviders(type: 'movie' | 'tv') {
  const [providers, setProviders] = useState<ProviderMap>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const fetchedRef = useRef<Set<string>>(new Set())
  const pendingRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementMapRef = useRef<Map<HTMLElement, string>>(new Map())

  const flush = useCallback(async () => {
    const ids = Array.from(pendingRef.current)
    pendingRef.current.clear()
    if (ids.length === 0) return

    setLoadingIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })

    try {
      const response = await fetch('/api/v1/watch-providers/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbIds: ids, type }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.providers && Object.keys(data.providers).length > 0) {
          setProviders((prev) => ({ ...prev, ...data.providers }))
        }
      }
    } catch {
      // Silently fail - badges are optional
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }
  }, [type])

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 200)
  }, [flush])

  // Create observer once
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const tmdbId = elementMapRef.current.get(entry.target as HTMLElement)
          if (!tmdbId || fetchedRef.current.has(tmdbId)) continue
          fetchedRef.current.add(tmdbId)
          pendingRef.current.add(tmdbId)
        }
        if (pendingRef.current.size > 0) {
          scheduleFlush()
        }
      },
      { rootMargin: '200px' }
    )

    return () => {
      observerRef.current?.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scheduleFlush])

  const createRef = useCallback(
    (tmdbId: string) => (el: HTMLDivElement | null) => {
      if (!observerRef.current) return

      // Clean up any previous element for this tmdbId
      for (const [existingEl, id] of elementMapRef.current) {
        if (id === tmdbId && existingEl !== el) {
          observerRef.current.unobserve(existingEl)
          elementMapRef.current.delete(existingEl)
        }
      }

      if (el) {
        elementMapRef.current.set(el, tmdbId)
        observerRef.current.observe(el)
      }
    },
    []
  )

  return { providers, loadingIds, observerRef: createRef }
}
