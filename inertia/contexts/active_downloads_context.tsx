import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'

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

interface ActiveDownloadsContextValue {
  queue: QueueItem[]
  getForMovie: (movieId: string) => ActiveDownloadInfo | null
  getForBook: (bookId: string) => ActiveDownloadInfo | null
  getForEpisode: (episodeId: string) => ActiveDownloadInfo | null
  getForAlbum: (albumId: string) => ActiveDownloadInfo[]
  getForTvShow: (showId: string) => Map<string, ActiveDownloadInfo>
  refresh: () => Promise<void>
}

const ActiveDownloadsContext = createContext<ActiveDownloadsContextValue | null>(null)

const POLL_INTERVAL = 5000

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
      value={{ queue, getForMovie, getForBook, getForEpisode, getForAlbum, getForTvShow, refresh: fetchQueue }}
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
