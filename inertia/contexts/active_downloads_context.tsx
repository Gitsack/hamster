import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'

export interface ActiveDownloadInfo {
  progress: number
  status: string
  title: string
  size: number | null
  remaining: number | null
  eta: number | null
  downloadClient: string
}

export interface QueueItem {
  id: string
  externalId: string
  title: string
  status: string
  progress: number
  size: number | null
  remaining: number | null
  eta: number | null
  albumId: string | null
  movieId: string | null
  tvShowId: string | null
  episodeId: string | null
  bookId: string | null
  downloadClient: string
  startedAt: string | null
}

function toDownloadInfo(item: QueueItem): ActiveDownloadInfo {
  return {
    progress: item.progress || 0,
    status: item.status || 'downloading',
    title: item.title || '',
    size: item.size ?? null,
    remaining: item.remaining ?? null,
    eta: item.eta ?? null,
    downloadClient: item.downloadClient || '',
  }
}

/** GET /api/v1/activity/counts — database COUNTs only, cheap enough to poll. */
export interface ActivityCounts {
  /** Queued, downloading or paused in a client. */
  active: number
  /** Failures a person has to act on. */
  failed: number
  /** Failures Hamster handles by itself: bad releases, network hiccups, duplicates. */
  failedRoutine?: number
  /** Every download currently being imported. */
  importing: number
  /** Imports untouched past the recovery threshold. */
  stuckImporting: number
  /** Scanned files nobody has matched or ignored yet. */
  unmatchedPending: number
}

/** What needs the operator: failures plus imports that stopped moving. */
export function attentionCount(counts: ActivityCounts | null): number {
  return counts ? counts.failed + counts.stuckImporting : 0
}

interface ActiveDownloadsContextValue {
  queue: QueueItem[]
  /** Null until the first answer arrives, so badges never paint a false zero. */
  counts: ActivityCounts | null
  getForMovie: (movieId: string) => ActiveDownloadInfo | null
  getForBook: (bookId: string) => ActiveDownloadInfo | null
  getForEpisode: (episodeId: string) => ActiveDownloadInfo | null
  getForAlbum: (albumId: string) => ActiveDownloadInfo[]
  getForTvShow: (showId: string) => Map<string, ActiveDownloadInfo>
  refresh: () => Promise<void>
  refreshCounts: () => Promise<void>
}

const ActiveDownloadsContext = createContext<ActiveDownloadsContextValue | null>(null)

const POLL_INTERVAL = 5000
const COUNTS_POLL_INTERVAL = 15000

export function ActiveDownloadsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/queue')
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
      }
    } catch {
      // Silently ignore - polling will retry
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    intervalRef.current = setInterval(fetchQueue, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchQueue])

  const [counts, setCounts] = useState<ActivityCounts | null>(null)

  const fetchCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/activity/counts')
      if (response.ok) {
        setCounts((await response.json()) as ActivityCounts)
      }
    } catch {
      // Keep the last known counts - the next poll will retry
    }
  }, [])

  // One poll for the whole app: the sidebar badge and the Activity tabs both read it.
  // A hidden tab skips its turns and catches up the moment it is shown again.
  useEffect(() => {
    fetchCounts()
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') fetchCounts()
    }, COUNTS_POLL_INTERVAL)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchCounts()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchCounts])

  const getForMovie = useCallback(
    (movieId: string): ActiveDownloadInfo | null => {
      const item = queue.find((q) => q.movieId === movieId)
      return item ? toDownloadInfo(item) : null
    },
    [queue]
  )

  const getForBook = useCallback(
    (bookId: string): ActiveDownloadInfo | null => {
      const item = queue.find((q) => q.bookId === bookId)
      return item ? toDownloadInfo(item) : null
    },
    [queue]
  )

  const getForEpisode = useCallback(
    (episodeId: string): ActiveDownloadInfo | null => {
      const item = queue.find((q) => q.episodeId === episodeId)
      return item ? toDownloadInfo(item) : null
    },
    [queue]
  )

  const getForAlbum = useCallback(
    (albumId: string): ActiveDownloadInfo[] => {
      return queue.filter((q) => q.albumId === albumId).map(toDownloadInfo)
    },
    [queue]
  )

  const getForTvShow = useCallback(
    (showId: string): Map<string, ActiveDownloadInfo> => {
      const map = new Map<string, ActiveDownloadInfo>()
      for (const item of queue) {
        if (item.tvShowId === showId && item.episodeId) {
          map.set(item.episodeId, toDownloadInfo(item))
        }
      }
      return map
    },
    [queue]
  )

  return (
    <ActiveDownloadsContext.Provider
      value={{
        queue,
        counts,
        getForMovie,
        getForBook,
        getForEpisode,
        getForAlbum,
        getForTvShow,
        refresh: fetchQueue,
        refreshCounts: fetchCounts,
      }}
    >
      {children}
    </ActiveDownloadsContext.Provider>
  )
}

export function useActiveDownloadsContext(): ActiveDownloadsContextValue {
  const context = useContext(ActiveDownloadsContext)
  if (!context) {
    throw new Error('useActiveDownloadsContext must be used within an ActiveDownloadsProvider')
  }
  return context
}

/**
 * The activity counts, or null outside the provider (Storybook, isolated tests)
 * and before the first poll answers.
 */
export function useActivityCounts(): ActivityCounts | null {
  return useContext(ActiveDownloadsContext)?.counts ?? null
}
