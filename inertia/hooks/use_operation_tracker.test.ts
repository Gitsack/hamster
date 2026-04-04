import { renderHook, act } from '@testing-library/react'
import { useOperationTracker } from './use_operation_tracker'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useOperationTracker', () => {
  it('starts with no active groups', () => {
    const { result } = renderHook(() => useOperationTracker())
    expect(result.current.activeGroups).toEqual([])
  })

  it('tracks a bulk operation group while running', async () => {
    const { result } = renderHook(() => useOperationTracker())

    let resolveA!: () => void
    let resolveB!: () => void

    const promiseA = new Promise<void>((r) => {
      resolveA = r
    })
    const promiseB = new Promise<void>((r) => {
      resolveB = r
    })

    let bulkPromise: Promise<unknown>

    await act(async () => {
      bulkPromise = result.current.runBulk('Test group', [
        { id: 'a', label: 'Item A', execute: () => promiseA },
        { id: 'b', label: 'Item B', execute: () => promiseB },
      ])
    })

    // Group should exist with pending operations
    expect(result.current.activeGroups).toHaveLength(1)
    expect(result.current.activeGroups[0].label).toBe('Test group')
    expect(result.current.activeGroups[0].operations).toHaveLength(2)
    expect(result.current.activeGroups[0].operations[0].status).toBe('pending')
    expect(result.current.activeGroups[0].operations[1].status).toBe('pending')

    // Resolve first operation
    await act(async () => {
      resolveA()
      await Promise.resolve()
    })

    expect(result.current.activeGroups[0].operations[0].status).toBe('success')
    expect(result.current.activeGroups[0].operations[1].status).toBe('pending')

    // Resolve second operation
    await act(async () => {
      resolveB()
      await bulkPromise!
    })

    expect(result.current.activeGroups[0].operations[1].status).toBe('success')

    // Group auto-removed after 3s
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.activeGroups).toHaveLength(0)
  })

  it('tracks errors in operations', async () => {
    const { result } = renderHook(() => useOperationTracker())

    let results: Awaited<ReturnType<typeof result.current.runBulk>>

    await act(async () => {
      results = await result.current.runBulk('Test group', [
        {
          id: 'good',
          label: 'Good',
          execute: async () => 'ok',
        },
        {
          id: 'bad',
          label: 'Bad',
          execute: async () => {
            throw new Error('fail')
          },
        },
      ])
    })

    expect(results!).toHaveLength(2)
    expect(results![0].status).toBe('success')
    expect(results![0].value).toBe('ok')
    expect(results![1].status).toBe('error')

    // Group should show error state
    const errorOp = result.current.activeGroups[0].operations.find((op) => op.id === 'bad')
    expect(errorOp?.status).toBe('error')

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.activeGroups).toHaveLength(0)
  })

  it('returns empty results for empty items list', async () => {
    const { result } = renderHook(() => useOperationTracker())

    let results: Awaited<ReturnType<typeof result.current.runBulk>>

    await act(async () => {
      results = await result.current.runBulk('Empty', [])
    })

    expect(results!).toEqual([])
    expect(result.current.activeGroups).toHaveLength(0)
  })
})
