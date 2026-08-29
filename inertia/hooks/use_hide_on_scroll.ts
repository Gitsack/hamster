import { useEffect, useRef, useState, type RefObject } from 'react'

/** Scrolled past this before the bar is allowed to hide, so short pages never lose it. */
const HIDE_AFTER = 96
/** Ignore jitter and rubber-banding; only a deliberate drag flips the bar. */
const DELTA = 6

/**
 * Tracks scroll direction in a container and reports whether a pinned bar should hide.
 *
 * Scrolling down past `HIDE_AFTER` hides it, scrolling up brings it straight back, and
 * the top of the page always shows it. `ref` should point at the scrolling element;
 * when it is null the window is used, so this works whether the page scrolls itself or
 * a pane inside it does.
 */
export function useHideOnScroll(ref?: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const target = ref?.current
    // Whichever element is actually scrolling wins. If the pane never resolved a height
    // the document scrolls instead, and reading the pane would report a frozen 0.
    const scrolls = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1
    const readY = () => (target && scrolls(target) ? target.scrollTop : window.scrollY)

    lastY.current = readY()

    const update = () => {
      frame.current = null
      const y = readY()
      const diff = y - lastY.current

      if (Math.abs(diff) < DELTA) return
      lastY.current = y

      // At rest near the top there is nothing to reclaim, so stay visible.
      if (y <= HIDE_AFTER) {
        setHidden(false)
        return
      }
      setHidden(diff > 0)
    }

    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(update)
    }

    target?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      target?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [ref])

  return hidden
}
