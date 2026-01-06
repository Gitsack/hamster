import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

interface PlaybackInfo {
  needsTranscode: boolean
  transcodeReason: string | null
  playbackUrl: string
  duration: number
  audioCodec: string | null
}

interface VideoPlayerProps {
  mediaType: 'movie' | 'episode'
  mediaFileId: string | number
  title?: string
  onError?: (error: string) => void
}

export function VideoPlayer({ mediaType, mediaFileId, title, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playbackInfo, setPlaybackInfo] = useState<PlaybackInfo | null>(null)

  useEffect(() => {
    let mounted = true
    let sessionId: string | null = null

    const initPlayer = async () => {
      try {
        // Fetch playback info to determine if transcoding is needed
        const response = await fetch(`/api/v1/playback/${mediaType}/${mediaFileId}/info`)
        if (!response.ok) {
          throw new Error('Failed to get playback info')
        }

        const info: PlaybackInfo = await response.json()
        if (!mounted) return

        setPlaybackInfo(info)

        // Extract session ID from HLS URL if transcoding
        if (info.needsTranscode && info.playbackUrl.includes('/hls/')) {
          const match = info.playbackUrl.match(/\/hls\/([^/]+)\//)
          if (match) {
            sessionId = match[1]
          }
        }

        const video = videoRef.current
        if (!video) return

        if (info.needsTranscode && Hls.isSupported()) {
          // Use HLS.js for transcoded content
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 120,
            startLevel: -1, // Auto quality
            // Fragment loading settings - allow longer timeouts for on-demand transcoding
            fragLoadingTimeOut: 60000, // 60 seconds for segment loading
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 2000,
            // Level loading settings
            levelLoadingTimeOut: 30000,
            levelLoadingMaxRetry: 3,
            // Enable low latency mode off for better seeking
            lowLatencyMode: false,
            // Allow seeking to unbuffered positions
            backBufferLength: 30,
          })

          hlsRef.current = hls

          hls.loadSource(info.playbackUrl)
          hls.attachMedia(video)

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (mounted) {
              setLoading(false)
              video.play().catch(() => {
                // Autoplay blocked, user will need to click play
              })
            }
          })

          // Log fragment loading for debugging
          hls.on(Hls.Events.FRAG_LOADING, (_, data) => {
            console.log(`Loading fragment ${data.frag.sn}...`)
          })

          hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
            console.log(`Fragment ${data.frag.sn} loaded`)
          })

          hls.on(Hls.Events.ERROR, (_, data) => {
            console.error('HLS error:', data.type, data.details, data.fatal)

            if (data.fatal) {
              console.error('HLS fatal error:', data)
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  // Try to recover from network error
                  console.log('Attempting to recover from network error...')
                  hls.startLoad()
                  break
                case Hls.ErrorTypes.MEDIA_ERROR:
                  // Try to recover from media error
                  console.log('Attempting to recover from media error...')
                  hls.recoverMediaError()
                  break
                default:
                  if (mounted) {
                    setError('Playback error: ' + data.details)
                    onError?.('Playback error: ' + data.details)
                  }
                  break
              }
            }
          })
        } else if (info.needsTranscode && video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          video.src = info.playbackUrl
          video.addEventListener('loadedmetadata', () => {
            if (mounted) {
              setLoading(false)
              video.play().catch(() => {})
            }
          })
        } else {
          // Direct play - no transcoding needed
          video.src = info.playbackUrl
          video.addEventListener('loadedmetadata', () => {
            if (mounted) {
              setLoading(false)
              video.play().catch(() => {})
            }
          })
        }

        video.addEventListener('error', () => {
          if (mounted) {
            const errorMessage = video.error?.message || 'Video playback error'
            setError(errorMessage)
            onError?.(errorMessage)
          }
        })
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load video'
          setError(errorMessage)
          onError?.(errorMessage)
          setLoading(false)
        }
      }
    }

    initPlayer()

    // Cleanup function
    return () => {
      mounted = false

      // Destroy HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      // Clean up transcoding session
      if (sessionId) {
        fetch(`/api/v1/playback/hls/${sessionId}`, { method: 'DELETE' }).catch(() => {
          // Ignore cleanup errors
        })
      }
    }
  }, [mediaType, mediaFileId, onError])

  if (error) {
    return (
      <div className="relative w-full bg-black flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
        <div className="text-center text-white p-4">
          <p className="text-red-400 mb-2">Failed to play video</p>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      {loading && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
          <div className="text-center">
            <Spinner className="w-8 h-8 mb-2" />
            <p className="text-white text-sm">
              {playbackInfo?.needsTranscode ? 'Preparing stream...' : 'Loading...'}
            </p>
          </div>
        </div>
      )}

      {playbackInfo?.needsTranscode && !loading && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="secondary" className="bg-yellow-600 text-white">
            Transcoding
          </Badge>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        className="w-full h-full bg-black"
        playsInline
      >
        Your browser does not support the video element.
      </video>
    </div>
  )
}
