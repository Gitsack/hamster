import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { HugeiconsIcon } from '@hugeicons/react'
import { Download01Icon, Time01Icon, HardDriveIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import type { ActiveDownloadInfo } from '@/hooks/use_active_downloads'

interface DownloadProgressCardProps {
  downloads: ActiveDownloadInfo[]
  className?: string
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  if (minutes > 0) return `${minutes}m ${secs}s remaining`
  return `${secs}s remaining`
}

function DownloadItem({ download }: { download: ActiveDownloadInfo }) {
  const isImporting = download.status === 'importing'
  const downloaded =
    download.size && download.remaining !== null ? download.size - download.remaining : null

  // Status ramp: transit magenta while the file is being moved into the
  // library, transfer cyan while it is still coming down the wire.
  const tone = isImporting ? 'text-status-transit-ink' : 'text-status-transfer-ink'
  const bar = isImporting
    ? '[&_[data-slot=progress-indicator]]:bg-status-transit [&_[data-slot=progress-indicator]]:animate-pulse'
    : '[&_[data-slot=progress-indicator]]:bg-status-transfer'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <HugeiconsIcon icon={Download01Icon} className={cn('h-4 w-4 flex-shrink-0', tone)} />
          <span className="text-sm font-medium truncate">{download.title}</span>
        </div>
        <span className={cn('readout text-xs font-medium flex-shrink-0', tone)}>
          {isImporting ? 'Importing' : `${Math.round(download.progress)}%`}
        </span>
      </div>
      <Progress value={isImporting ? 100 : download.progress} className={cn('h-1.5', bar)} />
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {downloaded !== null && download.size && (
          <div className="flex items-center gap-1">
            <HugeiconsIcon icon={HardDriveIcon} className="h-3 w-3" />
            <span className="readout">
              {formatFileSize(downloaded)} / {formatFileSize(download.size)}
            </span>
          </div>
        )}
        {!isImporting && download.eta !== null && download.eta > 0 && (
          <div className="flex items-center gap-1">
            <HugeiconsIcon icon={Time01Icon} className="h-3 w-3" />
            <span className="readout">{formatEta(download.eta)}</span>
          </div>
        )}
        {download.downloadClient && (
          <span className="readout ml-auto truncate">{download.downloadClient}</span>
        )}
      </div>
    </div>
  )
}

export function DownloadProgressCard({ downloads, className }: DownloadProgressCardProps) {
  if (downloads.length === 0) return null

  return (
    <Card className={cn('py-4', className)}>
      <CardContent className="space-y-4">
        {downloads.map((download, index) => (
          <DownloadItem key={`${download.title}-${index}`} download={download} />
        ))}
      </CardContent>
    </Card>
  )
}
