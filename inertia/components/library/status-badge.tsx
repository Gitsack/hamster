import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  Clock01Icon,
  Download01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type ItemStatus = 'downloaded' | 'requested' | 'downloading' | 'none'

interface StatusBadgeProps {
  status: ItemStatus
  progress?: number
  className?: string
  showLabel?: boolean
}

export function StatusBadge({ status, progress = 0, className, showLabel = true }: StatusBadgeProps) {
  if (status === 'none') return null

  const statusConfig = {
    downloaded: {
      label: 'Downloaded',
      icon: CheckmarkCircle01Icon,
      variant: 'default' as const,
      className: 'bg-green-600 hover:bg-green-600 text-white',
    },
    requested: {
      label: 'Requested',
      icon: Clock01Icon,
      variant: 'secondary' as const,
      className: 'bg-yellow-600 hover:bg-yellow-600 text-white',
    },
    downloading: {
      label: 'Downloading',
      icon: Download01Icon,
      variant: 'default' as const,
      className: 'bg-blue-600 hover:bg-blue-600 text-white',
    },
  }

  const config = statusConfig[status]

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, 'gap-1', className)}
    >
      <HugeiconsIcon icon={config.icon} className="h-3 w-3" />
      {showLabel && <span>{config.label}</span>}
      {status === 'downloading' && progress > 0 && (
        <span className="ml-1">{Math.round(progress)}%</span>
      )}
    </Badge>
  )
}

interface StatusProgressOverlayProps {
  status: ItemStatus
  progress?: number
}

export function StatusProgressOverlay({ status, progress = 0 }: StatusProgressOverlayProps) {
  if (status !== 'downloading' || progress <= 0) return null

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-xs text-white font-medium">{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

interface StatusIndicatorProps {
  status: ItemStatus
  progress?: number
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export function StatusIndicator({ status, progress, position = 'top-right' }: StatusIndicatorProps) {
  if (status === 'none') return null

  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  }

  return (
    <div className={cn('absolute', positionClasses[position])}>
      <StatusBadge status={status} progress={progress} showLabel={false} />
    </div>
  )
}

// Helper function to determine item status
export function getItemStatus(
  item: { monitored: boolean; hasFiles?: boolean; fileCount?: number },
  activeDownloads: Array<{ artistId?: number | null; albumId?: number | null; progress: number }>,
  itemId: number,
  itemType: 'artist' | 'album' = 'artist'
): { status: ItemStatus; progress: number } {
  // Check if actively downloading
  const download = activeDownloads.find((d) =>
    itemType === 'artist' ? d.artistId === itemId : d.albumId === itemId
  )
  if (download) {
    return { status: 'downloading', progress: download.progress }
  }

  // Check if has any files
  const hasFiles = item.hasFiles || (item.fileCount !== undefined && item.fileCount > 0)
  if (hasFiles) {
    return { status: 'downloaded', progress: 100 }
  }

  // Monitored but no files = requested
  if (item.monitored) {
    return { status: 'requested', progress: 0 }
  }

  return { status: 'none', progress: 0 }
}
