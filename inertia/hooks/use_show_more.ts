import { useState, useMemo } from 'react'

/**
 * Hook for paginating lists with a "Show More" button.
 * Returns the visible slice plus helpers for expanding.
 */
export function useShowMore<T>(items: T[], pageSize: number = 50) {
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount])
  const hasMore = visibleCount < items.length
  const totalCount = items.length
  const shownCount = Math.min(visibleCount, items.length)

  function showMore() {
    setVisibleCount((prev) => prev + pageSize)
  }

  function showAll() {
    setVisibleCount(items.length)
  }

  function reset() {
    setVisibleCount(pageSize)
  }

  return { visibleItems, hasMore, totalCount, shownCount, showMore, showAll, reset }
}
