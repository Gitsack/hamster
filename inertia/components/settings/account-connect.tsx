import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ConnectedAccount {
  username: string
}

interface DeviceCode {
  userCode: string
  verificationUrl: string
  verificationUrlComplete: string | null
  expiresAt: number
  interval: number
}

type PollStatus =
  | 'authorized'
  | 'pending'
  | 'slow_down'
  | 'expired'
  | 'denied'
  | 'invalid'
  | 'no-flow'

const FAILURE: Partial<Record<PollStatus, string>> = {
  'expired': 'The code expired before it was approved. Start again for a new one.',
  'denied': 'The request was declined.',
  'invalid': 'The provider did not accept the code. Check the client ID and try again.',
  'no-flow': 'Hamster restarted and lost the sign-in. Start again.',
}

/**
 * Connect an external account (any provider in the server's account
 * registry) with the device-code flow: show a code, the user approves it on
 * the provider's site from any device, and we poll until the provider
 * hands over a token. No redirect URL, so it works on a LAN-only install.
 */
export function AccountConnect({
  provider,
  label,
  account,
  canConnect,
  onChange,
}: {
  provider: string
  label: string
  account: ConnectedAccount | null
  canConnect: boolean
  onChange: (account: ConnectedAccount | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [code, setCode] = useState<DeviceCode | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const pollTimer = useRef<number | null>(null)

  const stopPolling = () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current)
    pollTimer.current = null
  }

  useEffect(() => stopPolling, [])

  // Countdown for the code.
  useEffect(() => {
    if (!code) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [code])

  const poll = (interval: number) => {
    pollTimer.current = window.setTimeout(async () => {
      let status: PollStatus = 'pending'
      let username = ''
      try {
        const res = await fetch(`/api/v1/settings/accounts/${provider}/device/poll`, {
          method: 'POST',
        })
        const body = await res.json()
        status = body.status
        username = body.username ?? ''
      } catch {
        // A dropped poll is not a failure; the next one decides.
      }
      if (status === 'authorized') {
        stopPolling()
        setOpen(false)
        setCode(null)
        onChange({ username })
        toast.success(`Connected to ${label} as ${username}`)
        return
      }
      if (FAILURE[status]) {
        stopPolling()
        setCode(null)
        setFailure(FAILURE[status]!)
        return
      }
      poll(status === 'slow_down' ? interval + 1 : interval)
    }, interval * 1000)
  }

  const start = async () => {
    stopPolling()
    setFailure(null)
    setCode(null)
    setOpen(true)
    setStarting(true)
    try {
      const res = await fetch(`/api/v1/settings/accounts/${provider}/device`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFailure(body.error || `${label} refused to start sign-in.`)
        return
      }
      setNow(Date.now())
      setCode({
        userCode: body.userCode,
        verificationUrl: body.verificationUrl,
        verificationUrlComplete: body.verificationUrlComplete ?? null,
        expiresAt: Date.now() + body.expiresIn * 1000,
        interval: body.interval,
      })
      poll(body.interval || 5)
    } catch {
      setFailure(`Hamster could not reach ${label}. Check the connection and try again.`)
    } finally {
      setStarting(false)
    }
  }

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) {
      stopPolling()
      setCode(null)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/v1/settings/accounts/${provider}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onChange(null)
      toast.success(`Disconnected from ${label}`)
    } catch {
      toast.error('Could not disconnect — Hamster is unreachable. Try again.')
    } finally {
      setDisconnecting(false)
    }
  }

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code.userCode)
      toast.success('Code copied')
    } catch {
      // Clipboard needs a secure context; the code is on screen anyway.
    }
  }

  if (account) {
    return (
      <>
        <span className="text-sm">
          Connected as <span className="font-medium">{account.username}</span>
        </span>
        <Button variant="outline" size="sm" onClick={disconnect} disabled={disconnecting}>
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </>
    )
  }

  const secondsLeft = code ? Math.max(0, Math.round((code.expiresAt - now) / 1000)) : 0

  return (
    <>
      <Button size="sm" onClick={start} disabled={!canConnect}>
        Connect {label}
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {label}</DialogTitle>
            <DialogDescription>
              Approve Hamster on {label} from any device. Your profile can stay private.
            </DialogDescription>
          </DialogHeader>

          {starting && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Asking {label} for a code…
            </div>
          )}

          {failure && !starting && (
            <p role="alert" className="py-4 text-sm text-status-failed-ink">
              {failure}
            </p>
          )}

          {code && !starting && (
            <ol className="space-y-5 py-2">
              <li className="space-y-2">
                <p className="text-sm font-medium">1. Open the {label} activation page</p>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={code.verificationUrlComplete ?? code.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {code.verificationUrl.replace(/^https?:\/\//, '')}
                    <HugeiconsIcon icon={LinkSquare02Icon} />
                  </a>
                </Button>
              </li>
              <li className="space-y-2">
                <p className="text-sm font-medium">
                  {code.verificationUrlComplete
                    ? '2. Check the code matches, then allow access'
                    : '2. Enter this code'}
                </p>
                <div className="flex items-center gap-2">
                  <output
                    aria-label="Activation code"
                    className="readout rounded-md border border-border bg-muted px-4 py-2 text-2xl leading-8 font-semibold tracking-[0.2em] select-all"
                  >
                    {code.userCode}
                  </output>
                  <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy code">
                    <HugeiconsIcon icon={Copy01Icon} />
                  </Button>
                </div>
              </li>
              <li
                className="flex items-center gap-2 text-sm text-muted-foreground"
                aria-live="polite"
              >
                <Spinner className="size-4" />
                Waiting for approval —{' '}
                <span className="readout">
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </span>{' '}
                left
              </li>
            </ol>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            {failure && !starting && <Button onClick={start}>Try again</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
