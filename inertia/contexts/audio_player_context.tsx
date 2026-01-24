import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'

export interface Track {
  id: number
  trackId: number
  title: string
  trackNumber: number
  discNumber?: number
  duration: number | null
  album: {
    id: number
    title: string
    coverUrl: string | null
  }
  artist: {
    id: number
    name: string
  }
  streamUrl: string
}

export interface PlayerState {
  isPlaying: boolean
  currentTrack: Track | null
  playlist: Track[]
  currentIndex: number
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isShuffled: boolean
  repeatMode: 'none' | 'all' | 'one'
  isLoading: boolean
}

interface AudioPlayerContextValue extends PlayerState {
  play: (track?: Track) => void
  pause: () => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  setPlaylist: (tracks: Track[], startIndex?: number) => void
  addToQueue: (track: Track) => void
  clearQueue: () => void
  playAlbum: (albumId: number) => Promise<void>
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null)

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider')
  }
  return context
}

interface AudioPlayerProviderProps {
  children: ReactNode
}

export function AudioPlayerProvider({ children }: AudioPlayerProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTrack: null,
    playlist: [],
    currentIndex: -1,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isShuffled: false,
    repeatMode: 'none',
    isLoading: false,
  })

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.volume = state.volume

    const audio = audioRef.current

    const handleTimeUpdate = () => {
      setState((prev) => ({ ...prev, currentTime: audio.currentTime }))
    }

    const handleDurationChange = () => {
      setState((prev) => ({ ...prev, duration: audio.duration || 0 }))
    }

    const handleEnded = () => {
      // Handle track end based on repeat mode
      if (state.repeatMode === 'one') {
        audio.currentTime = 0
        audio.play()
      } else {
        next()
      }
    }

    const handlePlay = () => {
      setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }))
    }

    const handlePause = () => {
      setState((prev) => ({ ...prev, isPlaying: false }))
    }

    const handleWaiting = () => {
      setState((prev) => ({ ...prev, isLoading: true }))
    }

    const handleCanPlay = () => {
      setState((prev) => ({ ...prev, isLoading: false }))
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('canplay', handleCanPlay)

    // Load saved volume from localStorage
    const savedVolume = localStorage.getItem('playerVolume')
    if (savedVolume) {
      const volume = parseFloat(savedVolume)
      audio.volume = volume
      setState((prev) => ({ ...prev, volume }))
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTrack = useCallback((track: Track) => {
    if (!audioRef.current) return

    setState((prev) => ({
      ...prev,
      currentTrack: track,
      isLoading: true,
      currentTime: 0,
      duration: track.duration || 0,
    }))

    audioRef.current.src = track.streamUrl
    audioRef.current.load()
  }, [])

  const play = useCallback(
    (track?: Track) => {
      if (!audioRef.current) return

      if (track) {
        loadTrack(track)
        audioRef.current.play()
      } else if (state.currentTrack) {
        audioRef.current.play()
      }
    },
    [loadTrack, state.currentTrack]
  )

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const toggle = useCallback(() => {
    if (state.isPlaying) {
      pause()
    } else {
      play()
    }
  }, [state.isPlaying, play, pause])

  const next = useCallback(() => {
    if (state.playlist.length === 0) return

    let nextIndex: number

    if (state.isShuffled) {
      // Random next track
      nextIndex = Math.floor(Math.random() * state.playlist.length)
    } else if (state.currentIndex < state.playlist.length - 1) {
      nextIndex = state.currentIndex + 1
    } else if (state.repeatMode === 'all') {
      nextIndex = 0
    } else {
      return // End of playlist
    }

    setState((prev) => ({ ...prev, currentIndex: nextIndex }))
    play(state.playlist[nextIndex])
  }, [state.playlist, state.currentIndex, state.isShuffled, state.repeatMode, play])

  const previous = useCallback(() => {
    if (!audioRef.current) return

    // If more than 3 seconds in, restart current track
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }

    if (state.playlist.length === 0 || state.currentIndex <= 0) return

    const prevIndex = state.currentIndex - 1
    setState((prev) => ({ ...prev, currentIndex: prevIndex }))
    play(state.playlist[prevIndex])
  }, [state.playlist, state.currentIndex, play])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      localStorage.setItem('playerVolume', volume.toString())
    }
    setState((prev) => ({ ...prev, volume, isMuted: volume === 0 }))
  }, [])

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return

    if (state.isMuted) {
      audioRef.current.volume = state.volume || 1
      setState((prev) => ({ ...prev, isMuted: false }))
    } else {
      audioRef.current.volume = 0
      setState((prev) => ({ ...prev, isMuted: true }))
    }
  }, [state.isMuted, state.volume])

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, isShuffled: !prev.isShuffled }))
  }, [])

  const toggleRepeat = useCallback(() => {
    setState((prev) => {
      const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one']
      const currentIdx = modes.indexOf(prev.repeatMode)
      const nextMode = modes[(currentIdx + 1) % modes.length]
      return { ...prev, repeatMode: nextMode }
    })
  }, [])

  const setPlaylist = useCallback(
    (tracks: Track[], startIndex = 0) => {
      setState((prev) => ({
        ...prev,
        playlist: tracks,
        currentIndex: startIndex,
      }))

      if (tracks.length > 0 && startIndex >= 0 && startIndex < tracks.length) {
        play(tracks[startIndex])
      }
    },
    [play]
  )

  const addToQueue = useCallback((track: Track) => {
    setState((prev) => ({
      ...prev,
      playlist: [...prev.playlist, track],
    }))
  }, [])

  const clearQueue = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setState((prev) => ({
      ...prev,
      playlist: [],
      currentIndex: -1,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }))
  }, [])

  const playAlbum = useCallback(
    async (albumId: number) => {
      try {
        const response = await fetch(`/api/v1/playback/album/${albumId}/playlist`)
        if (response.ok) {
          const tracks: Track[] = await response.json()
          if (tracks.length > 0) {
            setPlaylist(tracks, 0)
          }
        }
      } catch (error) {
        console.error('Failed to load album playlist:', error)
      }
    },
    [setPlaylist]
  )

  const value: AudioPlayerContextValue = {
    ...state,
    play,
    pause,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    setPlaylist,
    addToQueue,
    clearQueue,
    playAlbum,
  }

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>
}
