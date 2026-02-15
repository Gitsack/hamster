import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

let matchMediaListener: (() => void) | null = null

beforeEach(() => {
  matchMediaListener = null
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  window.matchMedia = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn((_event: string, cb: () => void) => {
      matchMediaListener = cb
    }),
    removeEventListener: vi.fn(),
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useIsMobile', () => {
  it('returns false initially before effect runs (SSR-safe)', () => {
    // !!undefined === false
    const { result } = renderHook(() => useIsMobile())
    // After render + effect, it reads innerWidth which is 1024
    expect(result.current).toBe(false)
  })

  it('returns false for desktop widths (>= 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true for mobile widths (< 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false for exactly 768px (boundary)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true for 767px (just below boundary)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 767 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('calls matchMedia with correct breakpoint query', () => {
    renderHook(() => useIsMobile())
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)')
  })

  it('updates when matchMedia change event fires', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 })
      matchMediaListener?.()
    })

    expect(result.current).toBe(true)
  })

  it('cleans up event listener on unmount', () => {
    const removeEventListener = vi.fn()
    window.matchMedia = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn((_event: string, cb: () => void) => {
        matchMediaListener = cb
      }),
      removeEventListener,
    }))

    const { unmount } = renderHook(() => useIsMobile())
    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
