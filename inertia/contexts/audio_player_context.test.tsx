import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useAudioPlayer,
  AudioPlayerProvider,
  type Track,
} from './audio_player_context'

// Mock HTMLAudioElement
let mockAudio: {
  src: string
  volume: number
  currentTime: number
  duration: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  listeners: Record<string, Function[]>
}

function createMockAudio() {
  const listeners: Record<string, Function[]> = {}
  return {
    src: '',
    volume: 1,
    currentTime: 0,
    duration: 0,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)
    }),
    removeEventListener: vi.fn((event: string, cb: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((l) => l !== cb)
      }
    }),
    listeners,
  }
}

function emitAudioEvent(event: string) {
  if (mockAudio.listeners[event]) {
    mockAudio.listeners[event].forEach((cb) => cb())
  }
}

const mockFetch = vi.fn()

beforeEach(() => {
  mockAudio = createMockAudio()
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  vi.stubGlobal(
    'Audio',
    class MockAudio {
      constructor() {
        return mockAudio
      }
    }
  )
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 1,
    trackId: 101,
    title: 'Test Track',
    trackNumber: 1,
    duration: 240,
    album: { id: 1, title: 'Test Album', coverUrl: '/cover.jpg' },
    artist: { id: 1, name: 'Test Artist' },
    streamUrl: '/api/v1/stream/1',
    ...overrides,
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AudioPlayerProvider>{children}</AudioPlayerProvider>
}

describe('useAudioPlayer', () => {
  it('throws when used outside of AudioPlayerProvider', () => {
    expect(() => {
      renderHook(() => useAudioPlayer())
    }).toThrow('useAudioPlayer must be used within an AudioPlayerProvider')
  })

  it('returns context value when used within AudioPlayerProvider', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    expect(result.current).toBeDefined()
    expect(typeof result.current.play).toBe('function')
    expect(typeof result.current.pause).toBe('function')
    expect(typeof result.current.toggle).toBe('function')
    expect(typeof result.current.next).toBe('function')
    expect(typeof result.current.previous).toBe('function')
    expect(typeof result.current.seek).toBe('function')
    expect(typeof result.current.setVolume).toBe('function')
    expect(typeof result.current.toggleMute).toBe('function')
    expect(typeof result.current.toggleShuffle).toBe('function')
    expect(typeof result.current.toggleRepeat).toBe('function')
    expect(typeof result.current.setPlaylist).toBe('function')
    expect(typeof result.current.addToQueue).toBe('function')
    expect(typeof result.current.clearQueue).toBe('function')
    expect(typeof result.current.playAlbum).toBe('function')
  })

  it('has correct initial state', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    expect(result.current.isPlaying).toBe(false)
    expect(result.current.currentTrack).toBeNull()
    expect(result.current.playlist).toEqual([])
    expect(result.current.currentIndex).toBe(-1)
    expect(result.current.currentTime).toBe(0)
    expect(result.current.duration).toBe(0)
    expect(result.current.volume).toBe(1)
    expect(result.current.isMuted).toBe(false)
    expect(result.current.isShuffled).toBe(false)
    expect(result.current.repeatMode).toBe('none')
    expect(result.current.isLoading).toBe(false)
  })
})

describe('play', () => {
  it('loads and plays a track when provided', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const track = createTrack()

    act(() => {
      result.current.play(track)
    })

    expect(mockAudio.src).toBe(track.streamUrl)
    expect(mockAudio.load).toHaveBeenCalled()
    expect(mockAudio.play).toHaveBeenCalled()
    expect(result.current.currentTrack).toEqual(track)
  })

  it('resumes playback when called without a track and currentTrack exists', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const track = createTrack()

    act(() => {
      result.current.play(track)
    })

    mockAudio.play.mockClear()

    act(() => {
      result.current.play()
    })

    expect(mockAudio.play).toHaveBeenCalled()
  })
})

describe('pause', () => {
  it('pauses the audio element', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.pause()
    })

    expect(mockAudio.pause).toHaveBeenCalled()
  })
})

describe('toggle', () => {
  it('plays when currently paused', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const track = createTrack()

    // First load a track so there is something to play
    act(() => {
      result.current.play(track)
    })

    // Simulate the audio pausing
    act(() => {
      emitAudioEvent('pause')
    })

    mockAudio.play.mockClear()

    act(() => {
      result.current.toggle()
    })

    expect(mockAudio.play).toHaveBeenCalled()
  })

  it('pauses when currently playing', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const track = createTrack()

    act(() => {
      result.current.play(track)
    })

    // Simulate the audio playing
    act(() => {
      emitAudioEvent('play')
    })

    act(() => {
      result.current.toggle()
    })

    expect(mockAudio.pause).toHaveBeenCalled()
  })
})

describe('seek', () => {
  it('sets currentTime on the audio element', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.seek(42)
    })

    expect(mockAudio.currentTime).toBe(42)
  })
})

describe('volume', () => {
  it('sets volume on audio element and state', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.setVolume(0.5)
    })

    expect(mockAudio.volume).toBe(0.5)
    expect(result.current.volume).toBe(0.5)
  })

  it('persists volume to localStorage', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.setVolume(0.7)
    })

    expect(localStorage.getItem('playerVolume')).toBe('0.7')
  })

  it('sets isMuted to true when volume is 0', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.setVolume(0)
    })

    expect(result.current.isMuted).toBe(true)
  })

  it('loads saved volume from localStorage on mount', () => {
    localStorage.setItem('playerVolume', '0.3')

    renderHook(() => useAudioPlayer(), { wrapper })

    expect(mockAudio.volume).toBe(0.3)
  })
})

describe('toggleMute', () => {
  it('mutes audio when not muted', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.toggleMute()
    })

    expect(mockAudio.volume).toBe(0)
    expect(result.current.isMuted).toBe(true)
  })

  it('unmutes audio to previous volume when muted', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.setVolume(0.8)
    })

    act(() => {
      result.current.toggleMute()
    })

    expect(result.current.isMuted).toBe(true)

    act(() => {
      result.current.toggleMute()
    })

    expect(mockAudio.volume).toBe(0.8)
    expect(result.current.isMuted).toBe(false)
  })
})

describe('toggleShuffle', () => {
  it('toggles shuffle mode', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    expect(result.current.isShuffled).toBe(false)

    act(() => {
      result.current.toggleShuffle()
    })

    expect(result.current.isShuffled).toBe(true)

    act(() => {
      result.current.toggleShuffle()
    })

    expect(result.current.isShuffled).toBe(false)
  })
})

describe('toggleRepeat', () => {
  it('cycles through repeat modes: none -> all -> one -> none', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    expect(result.current.repeatMode).toBe('none')

    act(() => {
      result.current.toggleRepeat()
    })

    expect(result.current.repeatMode).toBe('all')

    act(() => {
      result.current.toggleRepeat()
    })

    expect(result.current.repeatMode).toBe('one')

    act(() => {
      result.current.toggleRepeat()
    })

    expect(result.current.repeatMode).toBe('none')
  })
})

describe('playlist management', () => {
  it('setPlaylist sets tracks and starts playing from startIndex', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [
      createTrack({ id: 1, title: 'Track 1', streamUrl: '/stream/1' }),
      createTrack({ id: 2, title: 'Track 2', streamUrl: '/stream/2' }),
      createTrack({ id: 3, title: 'Track 3', streamUrl: '/stream/3' }),
    ]

    act(() => {
      result.current.setPlaylist(tracks, 1)
    })

    expect(result.current.playlist).toEqual(tracks)
    expect(result.current.currentIndex).toBe(1)
    expect(mockAudio.src).toBe('/stream/2')
    expect(mockAudio.play).toHaveBeenCalled()
  })

  it('setPlaylist defaults to startIndex 0', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [createTrack({ streamUrl: '/stream/1' })]

    act(() => {
      result.current.setPlaylist(tracks)
    })

    expect(result.current.currentIndex).toBe(0)
    expect(mockAudio.src).toBe('/stream/1')
  })

  it('addToQueue appends a track to the playlist', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const track1 = createTrack({ id: 1, title: 'Track 1' })
    const track2 = createTrack({ id: 2, title: 'Track 2' })

    act(() => {
      result.current.addToQueue(track1)
    })

    expect(result.current.playlist).toHaveLength(1)

    act(() => {
      result.current.addToQueue(track2)
    })

    expect(result.current.playlist).toHaveLength(2)
    expect(result.current.playlist[1]).toEqual(track2)
  })

  it('clearQueue stops playback and resets state', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [createTrack()]

    act(() => {
      result.current.setPlaylist(tracks)
    })

    act(() => {
      result.current.clearQueue()
    })

    expect(mockAudio.pause).toHaveBeenCalled()
    expect(mockAudio.src).toBe('')
    expect(result.current.playlist).toEqual([])
    expect(result.current.currentIndex).toBe(-1)
    expect(result.current.currentTrack).toBeNull()
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.currentTime).toBe(0)
    expect(result.current.duration).toBe(0)
  })
})

describe('next', () => {
  it('advances to next track in playlist', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [
      createTrack({ id: 1, streamUrl: '/stream/1' }),
      createTrack({ id: 2, streamUrl: '/stream/2' }),
    ]

    act(() => {
      result.current.setPlaylist(tracks, 0)
    })

    act(() => {
      result.current.next()
    })

    expect(result.current.currentIndex).toBe(1)
  })

  it('does nothing when playlist is empty', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      result.current.next()
    })

    expect(result.current.currentIndex).toBe(-1)
  })

  it('wraps to beginning when repeatMode is all and at end of playlist', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [
      createTrack({ id: 1, streamUrl: '/stream/1' }),
      createTrack({ id: 2, streamUrl: '/stream/2' }),
    ]

    act(() => {
      result.current.setPlaylist(tracks, 0)
    })

    act(() => {
      result.current.toggleRepeat() // none -> all
    })

    act(() => {
      result.current.next() // go to index 1
    })

    act(() => {
      result.current.next() // should wrap to index 0
    })

    expect(result.current.currentIndex).toBe(0)
  })
})

describe('previous', () => {
  it('restarts current track if more than 3 seconds in', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [
      createTrack({ id: 1, streamUrl: '/stream/1' }),
      createTrack({ id: 2, streamUrl: '/stream/2' }),
    ]

    act(() => {
      result.current.setPlaylist(tracks, 1)
    })

    mockAudio.currentTime = 5

    act(() => {
      result.current.previous()
    })

    expect(mockAudio.currentTime).toBe(0)
  })

  it('goes to previous track if less than 3 seconds in', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [
      createTrack({ id: 1, streamUrl: '/stream/1' }),
      createTrack({ id: 2, streamUrl: '/stream/2' }),
    ]

    act(() => {
      result.current.setPlaylist(tracks, 1)
    })

    mockAudio.currentTime = 1

    act(() => {
      result.current.previous()
    })

    expect(result.current.currentIndex).toBe(0)
  })

  it('does nothing at beginning of playlist when less than 3 seconds in', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })
    const tracks = [createTrack({ id: 1, streamUrl: '/stream/1' })]

    act(() => {
      result.current.setPlaylist(tracks, 0)
    })

    mockAudio.currentTime = 1

    act(() => {
      result.current.previous()
    })

    expect(result.current.currentIndex).toBe(0)
  })
})

describe('audio events', () => {
  it('updates isPlaying on play event', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      emitAudioEvent('play')
    })

    expect(result.current.isPlaying).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('updates isPlaying on pause event', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      emitAudioEvent('play')
    })

    act(() => {
      emitAudioEvent('pause')
    })

    expect(result.current.isPlaying).toBe(false)
  })

  it('updates isLoading on waiting event', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      emitAudioEvent('waiting')
    })

    expect(result.current.isLoading).toBe(true)
  })

  it('clears isLoading on canplay event', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    act(() => {
      emitAudioEvent('waiting')
    })

    expect(result.current.isLoading).toBe(true)

    act(() => {
      emitAudioEvent('canplay')
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('updates currentTime on timeupdate event', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    mockAudio.currentTime = 30

    act(() => {
      emitAudioEvent('timeupdate')
    })

    expect(result.current.currentTime).toBe(30)
  })

  it('updates duration on durationchange event', () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    mockAudio.duration = 180

    act(() => {
      emitAudioEvent('durationchange')
    })

    expect(result.current.duration).toBe(180)
  })

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useAudioPlayer(), { wrapper })

    unmount()

    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith(
      'durationchange',
      expect.any(Function)
    )
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('waiting', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('canplay', expect.any(Function))
    expect(mockAudio.pause).toHaveBeenCalled()
  })
})

describe('playAlbum', () => {
  it('fetches album playlist and starts playing', async () => {
    const tracks = [
      createTrack({ id: 1, streamUrl: '/stream/1' }),
      createTrack({ id: 2, streamUrl: '/stream/2' }),
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tracks,
    })

    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    await act(async () => {
      await result.current.playAlbum(42)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/playback/album/42/playlist')
    expect(result.current.playlist).toEqual(tracks)
    expect(mockAudio.play).toHaveBeenCalled()
  })

  it('does nothing when fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    await act(async () => {
      await result.current.playAlbum(42)
    })

    expect(result.current.playlist).toEqual([])
    consoleSpy.mockRestore()
  })

  it('does nothing when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    await act(async () => {
      await result.current.playAlbum(42)
    })

    expect(result.current.playlist).toEqual([])
  })

  it('does nothing when album has no tracks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const { result } = renderHook(() => useAudioPlayer(), { wrapper })

    await act(async () => {
      await result.current.playAlbum(42)
    })

    expect(result.current.playlist).toEqual([])
    expect(mockAudio.play).not.toHaveBeenCalled()
  })
})
