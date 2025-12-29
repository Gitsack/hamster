import { useAudioPlayer } from '@/contexts/audio_player_context'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  PlayIcon,
  PauseIcon,
  Forward01Icon,
  Backward01Icon,
  VolumeHighIcon,
  VolumeOffIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOne01Icon,
  Loading01Icon,
  MusicNote01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AudioPlayer() {
  const {
    isPlaying,
    currentTrack,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    isLoading,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    clearQueue,
  } = useAudioPlayer()

  if (!currentTrack) {
    return null // Hide player when nothing is playing
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-background border-t z-50">
      <div className="h-full px-4 flex items-center gap-4">
        {/* Track info */}
        <div className="flex items-center gap-3 w-64 min-w-0">
          <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {currentTrack.album.coverUrl ? (
              <img
                src={currentTrack.album.coverUrl}
                alt={currentTrack.album.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <HugeiconsIcon icon={MusicNote01Icon} className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{currentTrack.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {currentTrack.artist.name} - {currentTrack.album.title}
            </div>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', isShuffled && 'text-primary')}
              onClick={toggleShuffle}
            >
              <HugeiconsIcon icon={ShuffleIcon} className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={previous}
            >
              <HugeiconsIcon icon={Backward01Icon} className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={toggle}
              disabled={isLoading}
            >
              {isLoading ? (
                <HugeiconsIcon icon={Loading01Icon} className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <HugeiconsIcon icon={PauseIcon} className="h-5 w-5" />
              ) : (
                <HugeiconsIcon icon={PlayIcon} className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={next}
            >
              <HugeiconsIcon icon={Forward01Icon} className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', repeatMode !== 'none' && 'text-primary')}
              onClick={toggleRepeat}
            >
              {repeatMode === 'one' ? (
                <HugeiconsIcon icon={RepeatOne01Icon} className="h-4 w-4" />
              ) : (
                <HugeiconsIcon icon={RepeatIcon} className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-md flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={([value]) => seek(value)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-2 w-36">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleMute}
          >
            <HugeiconsIcon
              icon={isMuted || volume === 0 ? VolumeOffIcon : VolumeHighIcon}
              className="h-4 w-4"
            />
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            max={100}
            step={1}
            onValueChange={([value]) => setVolume(value / 100)}
            className="w-24"
          />
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={clearQueue}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
