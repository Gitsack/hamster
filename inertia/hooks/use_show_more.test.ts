import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShowMore } from './use_show_more'

describe('useShowMore', () => {
  const items = Array.from({ length: 120 }, (_, i) => i)

  it('returns first page of items by default', () => {
    const { result } = renderHook(() => useShowMore(items))
    expect(result.current.visibleItems).toHaveLength(50)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.shownCount).toBe(50)
    expect(result.current.totalCount).toBe(120)
  })

  it('respects custom page size', () => {
    const { result } = renderHook(() => useShowMore(items, 20))
    expect(result.current.visibleItems).toHaveLength(20)
    expect(result.current.hasMore).toBe(true)
  })

  it('shows more items on showMore()', () => {
    const { result } = renderHook(() => useShowMore(items))
    act(() => result.current.showMore())
    expect(result.current.visibleItems).toHaveLength(100)
    expect(result.current.hasMore).toBe(true)
    act(() => result.current.showMore())
    expect(result.current.visibleItems).toHaveLength(120)
    expect(result.current.hasMore).toBe(false)
  })

  it('shows all items on showAll()', () => {
    const { result } = renderHook(() => useShowMore(items))
    act(() => result.current.showAll())
    expect(result.current.visibleItems).toHaveLength(120)
    expect(result.current.hasMore).toBe(false)
  })

  it('resets to first page', () => {
    const { result } = renderHook(() => useShowMore(items))
    act(() => result.current.showMore())
    act(() => result.current.reset())
    expect(result.current.visibleItems).toHaveLength(50)
  })

  it('returns all items when list is shorter than page size', () => {
    const short = [1, 2, 3]
    const { result } = renderHook(() => useShowMore(short))
    expect(result.current.visibleItems).toHaveLength(3)
    expect(result.current.hasMore).toBe(false)
  })

  it('handles empty array', () => {
    const { result } = renderHook(() => useShowMore([]))
    expect(result.current.visibleItems).toHaveLength(0)
    expect(result.current.hasMore).toBe(false)
    expect(result.current.totalCount).toBe(0)
  })
})
