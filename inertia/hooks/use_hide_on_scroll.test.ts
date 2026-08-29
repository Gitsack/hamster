import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHideOnScroll } from './use_hide_on_scroll'

describe('useHideOnScroll', () => {
  let container: HTMLDivElement
  let ref: { current: HTMLDivElement | null }

  /** Move the container and flush the rAF the scroll handler defers to. */
  function scrollTo(top: number) {
    act(() => {
      container.scrollTop = top
      container.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom has no rAF timing; a timer keeps the deferred update observable.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    container = document.createElement('div')
    // jsdom reports zero for both, which would read as "not scrollable".
    Object.defineProperty(container, 'scrollHeight', { value: 4000 })
    Object.defineProperty(container, 'clientHeight', { value: 800 })
    ref = { current: container }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('stays visible at the top of the page', () => {
    const { result } = renderHook(() => useHideOnScroll(ref))
    expect(result.current).toBe(false)
    scrollTo(40)
    expect(result.current).toBe(false)
  })

  it('hides once scrolled down past the threshold', () => {
    const { result } = renderHook(() => useHideOnScroll(ref))
    scrollTo(400)
    expect(result.current).toBe(true)
  })

  it('reappears on the first scroll up', () => {
    const { result } = renderHook(() => useHideOnScroll(ref))
    scrollTo(400)
    expect(result.current).toBe(true)
    scrollTo(360)
    expect(result.current).toBe(false)
  })

  it('ignores jitter below the delta', () => {
    const { result } = renderHook(() => useHideOnScroll(ref))
    scrollTo(400)
    scrollTo(403)
    expect(result.current).toBe(true)
  })

  it('follows the window when the pane is not the scroller', () => {
    // Safari can leave the pane unscrollable; the document scrolls instead.
    const flat = document.createElement('div')
    Object.defineProperty(flat, 'scrollHeight', { value: 800 })
    Object.defineProperty(flat, 'clientHeight', { value: 800 })
    const { result } = renderHook(() => useHideOnScroll({ current: flat }))

    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 400, configurable: true })
      window.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })
    expect(result.current).toBe(true)
  })

  it('shows again when scrolled back near the top', () => {
    const { result } = renderHook(() => useHideOnScroll(ref))
    scrollTo(400)
    expect(result.current).toBe(true)
    scrollTo(20)
    expect(result.current).toBe(false)
  })
})
