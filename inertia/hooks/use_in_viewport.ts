import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Reports when an element first reaches the viewport, so work below the fold can wait
 * until it is worth doing.
 *
 * Latches: once seen, it stays true and the observer disconnects — this gates one-shot
 * fetches, not visibility styling. Where IntersectionObserver does not exist (SSR, jsdom)
 * it reports visible immediately, so the gated work still runs rather than never running.
 */
export function useInViewport<T extends HTMLElement = HTMLDivElement>(rootMargin = '200px') {
  const [inViewport, setInViewport] = useState(
    () => typeof IntersectionObserver === 'undefined' || typeof window === 'undefined'
  )
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    return () => observerRef.current?.disconnect()
  }, [])

  const ref = useCallback(
    (el: T | null) => {
      observerRef.current?.disconnect()
      if (!el || typeof IntersectionObserver === 'undefined') return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInViewport(true)
            observerRef.current?.disconnect()
          }
        },
        { rootMargin }
      )
      observerRef.current.observe(el)
    },
    [rootMargin]
  )

  return { ref, inViewport }
}
