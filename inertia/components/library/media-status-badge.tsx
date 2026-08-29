import { useEffect, useState, type ReactNode } from 'react'
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
import { useCoarsePointer } from '@/hooks/use_coarse_pointer'

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

/** How long an armed badge waits for the confirming tap before standing down. */
const ARM_TIMEOUT = 3000

interface ReversibleBadgeProps {
  /** Status ramp fill for the resting state. */
  fill: string
  variant?: 'default' | 'secondary'
  icon: typeof CheckmarkCircle01Icon
  iconClassName?: string
  label: ReactNode
  labelClassName?: string
  consequenceIcon: typeof CheckmarkCircle01Icon
  consequenceLabel: ReactNode
  ariaLabel: string
  tooltip: ReactNode
  onConfirm?: () => void
  sizeClasses: string
  iconSize: string
  showText: boolean
  className?: string
}

/**
 * The reversible states share one contract: the badge IS the control, and the reversal
 * occupies the same pixels as the state it reverses.
 *
 * On a fine pointer that swap is hover. A phone has no hover, so the first tap *arms* the
 * badge — it takes on the same Alarm Red consequence face the hover produces — and a
 * second tap within three seconds commits. Same pixels, same colour, same words; only the
 * trigger differs. Moving focus away, or three seconds of nothing, stands it back down.
 *
 * Without an `onConfirm` there is nothing to reverse, so the badge renders as a plain
 * statement of state rather than a control that swaps to a threat and then does nothing.
 */
function ReversibleBadge({
  fill,
  variant = 'default',
  icon,
  iconClassName,
  label,
  labelClassName,
  consequenceIcon,
  consequenceLabel,
  ariaLabel,
  tooltip,
  onConfirm,
  sizeClasses,
  iconSize,
  showText,
  className,
}: ReversibleBadgeProps) {
  const coarsePointer = useCoarsePointer()
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT)
    return () => clearTimeout(timer)
  }, [armed])

  if (!onConfirm) {
    return (
      <Badge
        variant={variant}
        className={cn('gap-1 border-transparent text-white', fill, sizeClasses, className)}
      >
        <HugeiconsIcon icon={icon} className={cn(iconSize, iconClassName)} />
        {showText && <span className={labelClassName}>{label}</span>}
      </Badge>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            asChild
            variant={variant}
            className={cn(
              interactiveBadge,
              fill,
              'hover:bg-status-failed data-[armed=true]:bg-status-failed',
              sizeClasses,
              className
            )}
          >
            <button
              type="button"
              data-armed={armed ? 'true' : 'false'}
              aria-label={armed ? `Confirm — ${ariaLabel}` : ariaLabel}
              onClick={(e) => {
                e.stopPropagation()
                if (coarsePointer && !armed) {
                  setArmed(true)
                  return
                }
                setArmed(false)
                onConfirm()
              }}
              onBlur={() => setArmed(false)}
            >
              <HugeiconsIcon
                icon={icon}
                className={cn(
                  iconSize,
                  iconClassName,
                  'group-hover:hidden group-data-[armed=true]:hidden'
                )}
              />
              <HugeiconsIcon
                icon={consequenceIcon}
                className={cn(iconSize, 'hidden group-hover:block group-data-[armed=true]:block')}
              />
              {showText && (
                <>
                  <span
                    className={cn(
                      labelClassName,
                      'group-hover:hidden group-data-[armed=true]:hidden'
                    )}
                  >
                    {label}
                  </span>
                  <span className="hidden group-hover:inline group-data-[armed=true]:inline">
                    {consequenceLabel}
                  </span>
                </>
              )}
            </button>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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

  // The four reversible states share one control; see ReversibleBadge.
  if (status === 'downloaded') {
    return (
      <ReversibleBadge
        fill="bg-status-complete"
        icon={CheckmarkCircle01Icon}
        label="Downloaded"
        consequenceIcon={Delete02Icon}
        consequenceLabel="Remove"
        ariaLabel="Downloaded — remove from library"
        tooltip="Deletes the file from disk and removes it from the library"
        onConfirm={onToggleRequest}
        sizeClasses={sizeClasses}
        iconSize={iconSize}
        showText={showText}
        className={className}
      />
    )
  }

  if (status === 'downloading') {
    return (
      <ReversibleBadge
        fill="bg-status-transfer"
        icon={Download01Icon}
        label={`${Math.round(progress)}%`}
        labelClassName="readout"
        consequenceIcon={Cancel01Icon}
        consequenceLabel="Cancel"
        ariaLabel={`Downloading, ${Math.round(progress)}% — cancel this download`}
        tooltip="Cancels the download and removes it from the queue"
        onConfirm={onToggleRequest}
        sizeClasses={sizeClasses}
        iconSize={iconSize}
        showText={showText}
        className={className}
      />
    )
  }

  if (status === 'importing') {
    return (
      <ReversibleBadge
        fill="bg-status-transit"
        icon={PackageMovingIcon}
        iconClassName="animate-pulse"
        label="Importing"
        consequenceIcon={Cancel01Icon}
        consequenceLabel="Cancel"
        ariaLabel="Importing — cancel this import"
        tooltip="Moving and renaming the finished download — cancel to stop it"
        onConfirm={onToggleRequest}
        sizeClasses={sizeClasses}
        iconSize={iconSize}
        showText={showText}
        className={className}
      />
    )
  }

  if (status === 'requested') {
    return (
      <ReversibleBadge
        fill="bg-status-queued"
        variant="secondary"
        icon={Clock01Icon}
        label="Requested"
        consequenceIcon={Cancel01Icon}
        consequenceLabel="Unrequest"
        ariaLabel="Requested — stop monitoring"
        tooltip="Stops monitoring — no release will be grabbed"
        onConfirm={onToggleRequest}
        sizeClasses={sizeClasses}
        iconSize={iconSize}
        showText={showText}
        className={className}
      />
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
