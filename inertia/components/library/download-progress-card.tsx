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
  // SABnzbd can report a few KB more remaining than the job's size before the
  // first article lands; clamp so the readout never shows "-4.7 KB".
  const downloaded =
    download.size && download.remaining !== null
      ? Math.max(0, download.size - download.remaining)
      : null

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
          <span className="text-sm font-medium truncate" title={download.title}>
            {download.title}
          </span>
        </div>
        <span className={cn('readout text-xs font-medium flex-shrink-0', tone)}>
          {isImporting ? 'Importing' : `${Math.round(download.progress)}%`}
        </span>
      </div>
      <Progress value={isImporting ? 100 : download.progress} className={cn('h-1.5', bar)} />
      <div className="flex min-w-0 items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {downloaded !== null && download.size && (
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <HugeiconsIcon icon={HardDriveIcon} className="h-3 w-3" />
            <span className="readout">
              {formatFileSize(downloaded)} / {formatFileSize(download.size)}
            </span>
          </div>
        )}
        {!isImporting && download.eta !== null && download.eta > 0 && (
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <HugeiconsIcon icon={Time01Icon} className="h-3 w-3" />
            <span className="readout">{formatEta(download.eta)}</span>
          </div>
        )}
        {download.downloadClient && (
          <span className="readout ml-auto hidden truncate sm:inline">
            {download.downloadClient}
          </span>
        )}
      </div>
    </div>
  )
}

/** Rows shown before the list scrolls; enough to see what is moving without
 * a season-sized grab pushing the rest of the page below the fold. */
const VISIBLE_ROWS = 3

export function DownloadProgressCard({ downloads, className }: DownloadProgressCardProps) {
  if (downloads.length === 0) return null

  const scrolls = downloads.length > VISIBLE_ROWS
  const importing = downloads.filter((d) => d.status === 'importing').length

  return (
    <Card className={cn('gap-3 py-4', className)}>
      <div className="flex items-baseline justify-between gap-3 px-6">
        <h2 className="text-sm font-semibold">
          {downloads.length === 1 ? 'Download' : 'Downloads'}{' '}
          <span className="readout font-normal text-muted-foreground">{downloads.length}</span>
        </h2>
        {importing > 0 && (
          <span className="readout text-xs text-status-transit-ink">{importing} importing</span>
        )}
      </div>
      <CardContent
        role="list"
        aria-label="Active downloads"
        tabIndex={scrolls ? 0 : undefined}
        className={cn(
          'space-y-4',
          // ~3.4 rows tall: the sliver of the fourth tells you there is more.
          scrolls &&
            'max-h-[15rem] overflow-y-auto overscroll-contain pr-4 [scrollbar-width:thin] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md'
        )}
      >
        {downloads.map((download, index) => (
          <div role="listitem" key={`${download.title}-${index}`}>
            <DownloadItem download={download} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
