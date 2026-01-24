import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  Clock01Icon,
  Download01Icon,
  Cancel01Icon,
  Add01Icon,
  PackageMovingIcon,
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
 * Unified status badge component for all media types.
 *
 * Design principles (based on TV Shows reference):
 * - Downloaded: Green badge, not interactive (can't unrequest downloaded items)
 * - Requested: Yellow badge, hover shows "Unrequest" with destructive color
 * - Downloading: Blue badge with progress %, hover shows "Cancel"
 * - Importing: Purple badge with pulse animation, hover shows "Cancel"
 * - None: Shows "Request" button (outline variant)
 */
export function MediaStatusBadge({
  status,
  progress = 0,
  isToggling = false,
  onToggleRequest,
  className,
  size = 'default',
  showRequestButton = true,
}: MediaStatusBadgeProps) {
  const sizeClasses =
    size === 'tiny'
      ? 'h-5 text-[10px] px-1.5'
      : size === 'sm'
        ? 'h-6 text-xs'
        : 'h-7 text-sm'

  const iconSize =
    size === 'tiny' ? 'h-2.5 w-2.5' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const buttonIconSize = size === 'tiny' ? 'h-2.5 w-2.5' : size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const showText = size !== 'tiny'

  // Loading state while toggling
  if (isToggling) {
    return (
      <Badge
        variant="secondary"
        className={cn('bg-muted text-muted-foreground gap-1', sizeClasses, className)}
      >
        <Spinner className={iconSize} />
        {showText && <span>{status === 'none' ? 'Requesting...' : 'Unrequesting...'}</span>}
      </Badge>
    )
  }

  // Downloaded - Green, not interactive
  if (status === 'downloaded') {
    return (
      <Badge
        variant="default"
        className={cn('bg-green-600 hover:bg-green-600 text-white gap-1', sizeClasses, className)}
      >
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className={iconSize} />
        {showText && <span>Downloaded</span>}
      </Badge>
    )
  }

  // Downloading - Blue with progress, can cancel
  if (status === 'downloading') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="default"
              className={cn(
                'gap-1 cursor-pointer bg-blue-600 hover:bg-destructive text-white transition-colors group',
                sizeClasses,
                className
              )}
              onClick={(e) => {
                e.stopPropagation()
                onToggleRequest?.()
              }}
            >
              <HugeiconsIcon icon={Download01Icon} className={cn(iconSize, 'group-hover:hidden')} />
              <HugeiconsIcon icon={Cancel01Icon} className={cn(iconSize, 'hidden group-hover:block')} />
              {showText && (
                <>
                  <span className="group-hover:hidden">{Math.round(progress)}%</span>
                  <span className="hidden group-hover:inline">Cancel</span>
                </>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Click to cancel download</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Importing - Purple with animation, can cancel
  if (status === 'importing') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="default"
              className={cn(
                'gap-1 cursor-pointer bg-purple-600 hover:bg-destructive text-white transition-colors group',
                sizeClasses,
                className
              )}
              onClick={(e) => {
                e.stopPropagation()
                onToggleRequest?.()
              }}
            >
              <HugeiconsIcon icon={PackageMovingIcon} className={cn(iconSize, 'group-hover:hidden animate-pulse')} />
              <HugeiconsIcon icon={Cancel01Icon} className={cn(iconSize, 'hidden group-hover:block')} />
              {showText && (
                <>
                  <span className="group-hover:hidden">Importing</span>
                  <span className="hidden group-hover:inline">Cancel</span>
                </>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Processing download, click to cancel</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Requested - Yellow, can unrequest
  if (status === 'requested') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(
                'gap-1 cursor-pointer bg-yellow-600 hover:bg-destructive text-white transition-colors group',
                sizeClasses,
                className
              )}
              onClick={(e) => {
                e.stopPropagation()
                onToggleRequest?.()
              }}
            >
              <HugeiconsIcon icon={Clock01Icon} className={cn(iconSize, 'group-hover:hidden')} />
              <HugeiconsIcon icon={Cancel01Icon} className={cn(iconSize, 'hidden group-hover:block')} />
              {showText && (
                <>
                  <span className="group-hover:hidden">Requested</span>
                  <span className="hidden group-hover:inline">Unrequest</span>
                </>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Click to unrequest</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // None - Show Request button
  if (status === 'none' && showRequestButton) {
    // Tiny size: icon-only button
    if (size === 'tiny') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className={cn('h-5 w-5', className)}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRequest?.()
                }}
              >
                <HugeiconsIcon icon={Add01Icon} className={buttonIconSize} />
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
        className={cn('h-7 px-2 text-xs', size === 'sm' && 'h-6', className)}
        onClick={(e) => {
          e.stopPropagation()
          onToggleRequest?.()
        }}
      >
        <HugeiconsIcon icon={Add01Icon} className={cn(buttonIconSize, 'mr-1')} />
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

  const sizeClasses =
    size === 'tiny'
      ? 'h-5 text-[10px] px-1.5'
      : size === 'sm'
        ? 'h-6 text-xs'
        : 'h-7 text-sm'
  const iconSize = size === 'tiny' ? 'h-2.5 w-2.5' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const showText = size !== 'tiny'

  // Loading state
  if (isToggling) {
    return (
      <Badge
        variant="secondary"
        className={cn('bg-muted text-muted-foreground gap-1', sizeClasses, className)}
      >
        <Spinner className={iconSize} />
        {showText && <span>Requesting...</span>}
      </Badge>
    )
  }

  // None - Show Request button (with optional hover effect)
  // Tiny size: icon-only button
  if (size === 'tiny') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                'h-5 w-5',
                showOnHover && 'opacity-0 group-hover:opacity-100 transition-opacity',
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
      variant="secondary"
      size="sm"
      className={cn(
        'h-7 px-2 text-xs',
        size === 'sm' && 'h-6',
        showOnHover && 'opacity-0 group-hover:opacity-100 transition-opacity',
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        onToggleRequest?.()
      }}
    >
      <HugeiconsIcon icon={Add01Icon} className={cn(iconSize, 'mr-1')} />
      Request
    </Button>
  )
}
