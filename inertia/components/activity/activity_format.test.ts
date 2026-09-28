import {
  eventDetail,
  eventTypesFor,
  formatEta,
  formatSize,
  isActivityTab,
  mediaLabel,
  parseEventFilter,
  searchAgainUrl,
  timeAgo,
  type HistoryMedia,
} from './activity_format'

const noMedia: HistoryMedia = {
  movieId: null,
  movieTitle: null,
  tvShowId: null,
  tvShowTitle: null,
  episodeId: null,
  episodeTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  albumId: null,
  albumTitle: null,
  bookId: null,
  bookTitle: null,
}

describe('activity tabs', () => {
  it('knows its three tabs and nothing else', () => {
    expect(isActivityTab('queue')).toBe(true)
    expect(isActivityTab('imports')).toBe(true)
    expect(isActivityTab('history')).toBe(true)
    expect(isActivityTab('unmatched')).toBe(false)
    expect(isActivityTab(undefined)).toBe(false)
  })
})

describe('history event filter', () => {
  it('parses every ?event= value the plan links to', () => {
    for (const value of ['all', 'grabbed', 'imported', 'failures', 'deleted', 'renamed']) {
      expect(parseEventFilter(value)).toBe(value)
    }
  })

  it('falls back to all events for anything unknown', () => {
    expect(parseEventFilter(null)).toBe('all')
    expect(parseEventFilter('download_failed')).toBe('all')
  })

  it('maps filters onto the API event types', () => {
    expect(eventTypesFor('all')).toBeNull()
    expect(eventTypesFor('imported')).toBe('import_completed')
    expect(eventTypesFor('failures')).toBe('download_failed,import_failed')
    expect(eventTypesFor('deleted')).toBe('deleted')
    expect(eventTypesFor('renamed')).toBe('renamed')
  })
})

describe('mediaLabel', () => {
  it('links episodes to their show with an SxxEyy code', () => {
    expect(
      mediaLabel({
        ...noMedia,
        tvShowId: 's1',
        tvShowTitle: 'Severance',
        episodeId: 'e1',
        episodeTitle: 'Hello, Ms. Cobel',
        seasonNumber: 2,
        episodeNumber: 1,
      })
    ).toEqual({ text: 'Severance · S02E01 · Hello, Ms. Cobel', href: '/tvshow/s1' })
  })

  it('uses the library routes that exist', () => {
    expect(mediaLabel({ ...noMedia, movieId: 'm1', movieTitle: 'Heat' }).href).toBe('/movie/m1')
    expect(mediaLabel({ ...noMedia, albumId: 'a1', albumTitle: 'Blue' }).href).toBe('/album/a1')
    expect(mediaLabel({ ...noMedia, bookId: 'b1', bookTitle: 'Dune' }).href).toBe('/book/b1')
  })

  it('says so when an entry has no library item', () => {
    expect(mediaLabel(noMedia)).toEqual({ text: 'Unlinked', href: null })
  })
})

describe('searchAgainUrl', () => {
  it('searches the episode, not the whole show', () => {
    expect(searchAgainUrl({ ...noMedia, tvShowId: 's1', episodeId: 'e1' })).toBe(
      '/api/v1/tvshows/s1/episodes/e1/search'
    )
  })

  it('covers every media type', () => {
    expect(searchAgainUrl({ ...noMedia, movieId: 'm1' })).toBe('/api/v1/movies/m1/search')
    expect(searchAgainUrl({ ...noMedia, albumId: 'a1' })).toBe('/api/v1/albums/a1/search')
    expect(searchAgainUrl({ ...noMedia, bookId: 'b1' })).toBe('/api/v1/books/b1/search')
    expect(searchAgainUrl({ ...noMedia, tvShowId: 's1' })).toBe('/api/v1/tvshows/s1/search')
    expect(searchAgainUrl(noMedia)).toBeNull()
  })
})

describe('eventDetail', () => {
  it('shows the error on failures', () => {
    expect(eventDetail({ eventType: 'import_failed', data: { error: 'Disk full' } })).toBe(
      'Disk full'
    )
  })

  it('counts imported files and names the indexer', () => {
    expect(eventDetail({ eventType: 'import_completed', data: { filesImported: 1 } })).toBe(
      '1 file imported'
    )
    expect(eventDetail({ eventType: 'grabbed', data: { indexer: 'NZBgeek' } })).toBe('from NZBgeek')
    expect(eventDetail({ eventType: 'renamed', data: null })).toBeNull()
  })
})

describe('formatting', () => {
  it('formats sizes and leaves unknowns as a dash', () => {
    expect(formatSize(null)).toBe('—')
    expect(formatSize(1536 * 1024 * 1024)).toBe('1.5 GB')
    expect(formatSize(20 * 1048576)).toBe('20 MB')
  })

  it('formats an ETA only when there is one', () => {
    expect(formatEta(null)).toBeNull()
    expect(formatEta(90)).toBe('1m')
    expect(formatEta(3900)).toBe('1h 5m')
  })

  it('counts time ago from a fixed now', () => {
    const now = Date.parse('2026-09-27T12:00:00Z')
    expect(timeAgo('2026-09-27T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-09-27T11:56:00Z', now)).toBe('4m ago')
    expect(timeAgo('2026-09-27T09:00:00Z', now)).toBe('3h ago')
    expect(timeAgo('2026-09-25T12:00:00Z', now)).toBe('2d ago')
    expect(timeAgo(null, now)).toBe('')
  })
})
