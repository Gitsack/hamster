import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * "Process downloads": streams /api/v1/files/scan-all-stream and keeps the log.
 * Owned by the Activity page so a run started from the Queue's Actions menu and
 * one started from the Imports toolbar share one log and one lock.
 *
 * `onChange` fires whenever something was imported or cleaned, and once more at
 * the end, so the tabs can reload what they show.
 */
export function useProcessDownloads(onChange: () => void) {
  const [processing, setProcessing] = useState(false)
  const [messages, setMessages] = useState<string[]>([])
  const running = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    setProcessing(true)
    setMessages([])

    try {
      const response = await fetch('/api/v1/files/scan-all-stream', { method: 'POST' })
      if (!response.ok || !response.body) {
        toast.error(`Could not start the download scan (HTTP ${response.status})`, {
          description: 'The completed folder was left untouched. Retry, or check the server logs.',
        })
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let totalImported = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.phase === 'done') {
              try {
                const summary = JSON.parse(event.message)
                totalImported = summary.totalImported || 0
              } catch {
                // not a JSON summary
              }
            } else {
              setMessages((prev) => [...prev, String(event.message ?? '')])
              if (event.action === 'imported' || event.action === 'cleaned') {
                onChangeRef.current()
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      toast.success(
        totalImported > 0 ? `Done: ${totalImported} imported` : 'Done: nothing new to import'
      )
    } catch {
      toast.error('The download scan stopped early', {
        description:
          'Anything already imported is kept. Run Process downloads again to finish the rest.',
      })
    } finally {
      running.current = false
      setProcessing(false)
      onChangeRef.current()
    }
  }, [])

  return { processing, messages, run }
}
