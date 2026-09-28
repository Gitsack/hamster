import {
  DEFAULT_EVENTS,
  EVENT_KEYS,
  eventTypeLabel,
  pickEvents,
  pickMedia,
  summarizeEvents,
  summarizeMedia,
  type EventFlags,
} from './event_catalog'

function flags(on: Partial<EventFlags>): EventFlags {
  return { ...pickEvents({}), ...on }
}

describe('event catalog', () => {
  it('covers all nine backend event flags, Download included', () => {
    expect(EVENT_KEYS).toHaveLength(9)
    expect(EVENT_KEYS).toContain('onDownloadComplete')
    expect(EVENT_KEYS).toContain('onHealthRestored')
  })

  it('defaults new targets deliberately: outcomes on, chatter off', () => {
    expect(DEFAULT_EVENTS.onGrab).toBe(false)
    expect(DEFAULT_EVENTS.onDownloadComplete).toBe(false)
    expect(DEFAULT_EVENTS.onImportFailed).toBe(true)
    expect(DEFAULT_EVENTS.onHealthIssue).toBe(true)
  })

  it('summarises whole groups by name and partial groups by event', () => {
    expect(summarizeEvents(flags({}))).toBe('No events')
    expect(
      summarizeEvents(
        flags({ onImportComplete: true, onImportFailed: true, onUpgrade: true, onGrab: true })
      )
    ).toBe('Grabbed, Imports')
    expect(summarizeEvents(flags({ onDownloadComplete: true, onHealthIssue: true }))).toBe(
      'Download finished, Health issue'
    )
    const all = Object.fromEntries(EVENT_KEYS.map((key) => [key, true])) as EventFlags
    expect(summarizeEvents(all)).toBe('All events')
  })

  it('reads flags strictly and media leniently', () => {
    expect(pickEvents({ onGrab: 'yes' as unknown as boolean }).onGrab).toBe(false)
    expect(pickMedia({}).includeBooks).toBe(true)
    expect(pickMedia({ includeBooks: false }).includeBooks).toBe(false)
  })

  it('only mentions media types when some are off', () => {
    expect(summarizeMedia(pickMedia({}))).toBeNull()
    expect(summarizeMedia(pickMedia({ includeMusic: false, includeBooks: false }))).toBe(
      'Movies, TV only'
    )
    expect(
      summarizeMedia({
        includeMusic: false,
        includeMovies: false,
        includeTv: false,
        includeBooks: false,
      })
    ).toBe('No media types')
  })

  it('labels logged event types, and passes unknown ones through', () => {
    expect(eventTypeLabel('import.failed')).toBe('Import failed')
    expect(eventTypeLabel('download.completed')).toBe('Download finished')
    expect(eventTypeLabel('something.new')).toBe('something.new')
  })
})
