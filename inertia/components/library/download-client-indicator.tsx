import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import type { DownloadClientInfo } from '@/hooks/use_download_clients'

interface DownloadClientIndicatorProps {
  clients: DownloadClientInfo[]
  selectedClientId: number | null
  onClientChange: (clientId: number | null) => void
}

const clientTypeLabels: Record<string, string> = {
  sabnzbd: 'SABnzbd',
  nzbget: 'NZBGet',
  qbittorrent: 'qBittorrent',
  transmission: 'Transmission',
  deluge: 'Deluge',
}

export function DownloadClientIndicator({
  clients,
  selectedClientId,
  onClientChange,
}: DownloadClientIndicatorProps) {
  if (clients.length === 0) return null

  const activeClient = selectedClientId
    ? clients.find((c) => c.id === selectedClientId) ?? clients[0]
    : clients[0]

  const label = activeClient.name || clientTypeLabels[activeClient.type] || activeClient.type

  if (clients.length === 1) {
    return (
      <Badge variant="secondary" title="Download client">
        {label}
      </Badge>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 gap-1"
          title="Download client (click to change)"
        >
          {label}
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {clients.map((client) => (
          <DropdownMenuItem
            key={client.id}
            onClick={() => onClientChange(client.id === clients[0].id ? null : client.id)}
            className={client.id === activeClient.id ? 'font-medium' : ''}
          >
            {client.name || clientTypeLabels[client.type] || client.type}
            {client.id === clients[0].id && (
              <span className="ml-2 text-xs text-muted-foreground">(default)</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
