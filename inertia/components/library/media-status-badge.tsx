import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  Clock01Icon,
  Download01Icon,
  Cancel01Icon,
  Add01Icon,
  PackageMovingIcon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type MediaItemStatus = 'none' | 'requested' | 'downloading' | 'importing' | 'downloaded'

interface MediaStatusBadgeProps {
  status: MediaItemStatus
  progress?: number
  isToggling?: boolean
  onToggleRequest?: () => void
  className?: string
  /** Size variant - 'default' for detail pages, 'sm' for cards/grids, 'tiny' for poster overlays */
  size?: 'default' | 'sm' | 'tiny'
  /** Show the request button when status is 'none' */
  showRequestButton?: boolean
}

/**
 * Unified status badge component for all media types — the system's signature control.
 *
 * Colour is drawn exclusively from the named status ramp (theme-independent, white text):
 * - Downloaded: Complete Green — the file exists on disk
 * - Downloading: Transfer Cyan, carrying a live readout percentage
 * - Importing: Transit Magenta, icon pulsing while the file is moved and renamed
 * - Requested: Queued Amber — monitored, waiting for a release
 * - None: the Request affordance (outline button, or a 20px icon button on artwork)
 *
 * The badge IS the control: where the action is reversible, hovering swaps both the icon
 * and the label in place and the fill switches to Alarm Red to name the consequence.
 * It never grows a second button — state and reversal occupy the same pixels.
 */

/**
 * Shell shared by every interactive state so hover, motion and text colour stay identical.
 * Applied to a real `<button>` (via `Badge asChild`) so the control is reachable by keyboard
 * and inherits the focus ring from `badgeVariants`. Every ramp fill carries white text in
 * both themes, including the Alarm Red hover fill.
 */
const interactiveBadge =
  'group gap-1 cursor-pointer text-white border-transparent transition-colors duration-150 ease-out'

/** tiny = 20px icon-only (poster overlays) · sm = 24px (grids, tables) · default = 28px (detail pages) */
function badgeSizeClasses(size: 'default' | 'sm' | 'tiny') {
  if (size === 'tiny') return 'h-5 w-5 p-0'
  if (size === 'sm') return 'h-6 px-2 text-xs'
  return 'h-7 px-2 text-xs'
}

function badgeIconClasses(size: 'default' | 'sm' | 'tiny') {
  return size === 'default' ? 'h-3.5 w-3.5' : 'h-3 w-3'
}

export function MediaStatusBadge({
  status,
  progress = 0,
  isToggling = false,
  onToggleRequest,
  className,
  size = 'default',
  showRequestButton = true,
}: MediaStatusBadgeProps) {
  const sizeClasses = badgeSizeClasses(size)
  const iconSize = badgeIconClasses(size)
  const buttonIconSize = size === 'default' ? 'h-4 w-4' : 'h-3 w-3'
  const showText = size !== 'tiny'

  // Loading state while toggling
  if (isToggling) {
    return (
      <Badge
        variant="secondary"
        className={cn('bg-muted text-muted-foreground gap-1', sizeClasses, className)}
      >
        <Spinner className={iconSize} />
        {showText && <span>{status === 'none' ? 'Requesting…' : 'Unrequesting…'}</span>}
      </Badge>
    )
  }

  // Downloaded — Complete Green, hover reveals the destructive consequence
  if (status === 'downloaded') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              asChild
              variant="default"
              className={cn(
                interactiveBadge,
                'bg-status-complete hover:bg-status-failed',
                sizeClasses,
                className
              )}
            >
              <button
                type="button"
                aria-label="Downloaded — remove from library"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRequest?.()
                }}
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className={cn(iconSize, 'group-hover:hidden')}
                />
                <HugeiconsIcon
                  icon={Delete02Icon}
                  className={cn(iconSize, 'hidden group-hover:block')}
                />
                {showText && (
                  <>
                    <span className="group-hover:hidden">Downloaded</span>
                    <span className="hidden group-hover:inline">Remove</span>
                  </>
                )}
              </button>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Deletes the file from disk and removes it from the library
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Downloading — Transfer Cyan with a live readout percentage, cancellable
  if (status === 'downloading') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              asChild
              variant="default"
              className={cn(
                interactiveBadge,
                'bg-status-transfer hover:bg-status-failed',
                sizeClasses,
                className
              )}
            >
              <button
                type="button"
                aria-label={`Downloading, ${Math.round(progress)}% — cancel this download`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRequest?.()
                }}
              >
                <HugeiconsIcon
                  icon={Download01Icon}
                  className={cn(iconSize, 'group-hover:hidden')}
                />
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  className={cn(iconSize, 'hidden group-hover:block')}
                />
                {showText && (
                  <>
                    <span className="readout group-hover:hidden">{Math.round(progress)}%</span>
                    <span className="hidden group-hover:inline">Cancel</span>
                  </>
                )}
              </button>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Cancels the download and removes it from the queue</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Importing — Transit Magenta, the one state that animates
  if (status === 'importing') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              asChild
              variant="default"
              className={cn(
                interactiveBadge,
                'bg-status-transit hover:bg-status-failed',
                sizeClasses,
                className
              )}
            >
              <button
                type="button"
                aria-label="Importing — cancel this import"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRequest?.()
                }}
              >
                <HugeiconsIcon
                  icon={PackageMovingIcon}
                  className={cn(iconSize, 'group-hover:hidden animate-pulse')}
                />
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  className={cn(iconSize, 'hidden group-hover:block')}
                />
                {showText && (
                  <>
                    <span className="group-hover:hidden">Importing</span>
                    <span className="hidden group-hover:inline">Cancel</span>
                  </>
                )}
              </button>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Moving and renaming the finished download — cancel to stop it
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Requested — Queued Amber, nothing is wrong and nothing has happened yet
  if (status === 'requested') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              asChild
              variant="secondary"
              className={cn(
                interactiveBadge,
                'bg-status-queued hover:bg-status-failed',
                sizeClasses,
                className
              )}
            >
              <button
                type="button"
                aria-label="Requested — stop monitoring"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRequest?.()
                }}
              >
                <HugeiconsIcon icon={Clock01Icon} className={cn(iconSize, 'group-hover:hidden')} />
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  className={cn(iconSize, 'hidden group-hover:block')}
                />
                {showText && (
                  <>
                    <span className="group-hover:hidden">Requested</span>
                    <span className="hidden group-hover:inline">Unrequest</span>
                  </>
                )}
              </button>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Stops monitoring — no release will be grabbed</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // None — Show Request affordance
  if (status === 'none' && showRequestButton) {
    // Tiny size: 20px icon-only button, matching the tiny badge footprint on artwork
    if (size === 'tiny') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Add to library"
                className={cn('h-5 w-5', className)}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRequest?.()
                }}
              >
                <HugeiconsIcon icon={Add01Icon} className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add to library</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-1 px-2 text-xs', size === 'sm' ? 'h-6' : 'h-7', className)}
        onClick={(e) => {
          e.stopPropagation()
          onToggleRequest?.()
        }}
      >
        <HugeiconsIcon icon={Add01Icon} className={buttonIconSize} />
        Request
      </Button>
    )
  }

  return null
}

/**
 * Helper function to determine item status based on common properties
 */
export function getMediaItemStatus(
  item: {
    hasFile?: boolean
    requested?: boolean
  },
  activeDownload?: { progress: number; status: string } | null
): { status: MediaItemStatus; progress: number } {
  if (item.hasFile) {
    return { status: 'downloaded', progress: 100 }
  }
  if (activeDownload) {
    if (activeDownload.status === 'importing') {
      return { status: 'importing', progress: 100 }
    }
    return { status: 'downloading', progress: activeDownload.progress }
  }
  if (item.requested) {
    return { status: 'requested', progress: 0 }
  }
  return { status: 'none', progress: 0 }
}

/**
 * Card-specific status badge for grid views.
 * This variant is used in the Author page BookCard and similar grid components.
 * It includes hover-to-show behavior for the request button when status is 'none'.
 */
interface CardStatusBadgeProps extends Omit<MediaStatusBadgeProps, 'showRequestButton'> {
  /** When true, the request button only shows on hover (for grid cards) */
  showOnHover?: boolean
}

export function CardStatusBadge({
  status,
  progress = 0,
  isToggling = false,
  onToggleRequest,
  className,
  size = 'sm',
  showOnHover = false,
}: CardStatusBadgeProps) {
  // For non-none statuses, use the regular badge
  if (status !== 'none') {
    return (
      <MediaStatusBadge
        status={status}
        progress={progress}
        isToggling={isToggling}
        onToggleRequest={onToggleRequest}
        className={className}
        size={size}
      />
    )
  }

  const sizeClasses = badgeSizeClasses(size)
  const iconSize = badgeIconClasses(size)
  const showText = size !== 'tiny'

  // Loading state
  if (isToggling) {
    return (
      <Badge
        variant="secondary"
        className={cn('bg-muted text-muted-foreground gap-1', sizeClasses, className)}
      >
        <Spinner className={iconSize} />
        {showText && <span>Requesting…</span>}
      </Badge>
    )
  }

  // None - Show Request button (with optional hover effect)
  // Tiny size: 20px icon-only button on artwork
  if (size === 'tiny') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Add to library"
              className={cn(
                'h-5 w-5',
                showOnHover && 'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
                className
              )}
              onClick={(e) => {
                e.stopPropagation()
                onToggleRequest?.()
              }}
            >
              <HugeiconsIcon icon={Add01Icon} className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add to library</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'gap-1 px-2 text-xs',
        size === 'sm' ? 'h-6' : 'h-7',
        showOnHover && 'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        onToggleRequest?.()
      }}
    >
      <HugeiconsIcon icon={Add01Icon} className={iconSize} />
      Request
    </Button>
  )
}
