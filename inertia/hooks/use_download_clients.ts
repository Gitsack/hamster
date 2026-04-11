import { useState, useEffect } from 'react'

export interface DownloadClientInfo {
  id: number
  name: string
  type: string
  enabled: boolean
  priority: number
}

export function useDownloadClients() {
  const [clients, setClients] = useState<DownloadClientInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchClients() {
      try {
        const response = await fetch('/api/v1/downloadclients')
        if (response.ok) {
          const data = await response.json()
          if (!cancelled) {
            const enabled = data
              .filter((c: DownloadClientInfo) => c.enabled)
              .sort((a: DownloadClientInfo, b: DownloadClientInfo) => a.priority - b.priority)
            setClients(enabled)
          }
        }
      } catch {
        // Silently fail — indicator just won't show
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchClients()
    return () => {
      cancelled = true
    }
  }, [])

  const activeClient = clients[0] ?? null

  return { clients, activeClient, loading, hasMultiple: clients.length > 1 }
}
