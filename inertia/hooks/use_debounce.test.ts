import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './use_debounce'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('does not update the value before the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'hello' },
    })

    rerender({ value: 'world' })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBe('hello')
  })

  it('updates the value after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'hello' },
    })

    rerender({ value: 'world' })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('world')
  })

  it('resets the timer on rapid value changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'ab' })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    rerender({ value: 'abc' })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Should still be 'a' since timer resets on each change
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Now 300ms after the last change, should be 'abc'
    expect(result.current).toBe('abc')
  })

  it('works with number values', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), {
      initialProps: { value: 0 },
    })

    rerender({ value: 42 })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBe(42)
  })

  it('cleans up timer on unmount', () => {
    const { result, rerender, unmount } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'hello' },
    })

    rerender({ value: 'world' })
    unmount()

    // Timer should have been cleaned up, no errors
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('hello')
  })
})
