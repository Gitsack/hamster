import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

export interface LocalAccessOptions {
  enabled: boolean
}

/**
 * Whether the local network gets in without a login.
 */
export function LocalAccessCard() {
  const [options, setOptions] = useState<LocalAccessOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      const response = await fetch('/api/v1/settings/local-access')
      if (response.ok) {
        const data = await response.json()
        setOptions(data.options)
      }
    } catch {
      toast.error('Sign-in settings could not be loaded — Hamster is unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const save = async (next: LocalAccessOptions) => {
    setOptions(next)
    setSaving(true)
    try {
      const response = await fetch('/api/v1/settings/local-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        toast.error(body.error ?? 'Sign-in settings could not be saved.')
        await load()
        return
      }
      toast.success('Sign-in settings saved.')
    } catch {
      toast.error('Sign-in settings could not be saved — Hamster is unreachable.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Spinner />
        </CardContent>
      </Card>
    )
  }

  if (!options) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in</CardTitle>
        <CardDescription>
          On a home server, a login mostly gets in the way. Requests from your own network can skip
          it; anyone reaching Hamster from outside still has to sign in.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="local-access-enabled">No login from the local network</Label>
            <p className="text-muted-foreground text-xs">
              Local visitors act as the first administrator account. Behind a reverse proxy, it must
              pass the visitor&apos;s address on in X-Forwarded-For — most do by default.
            </p>
          </div>
          <Switch
            id="local-access-enabled"
            checked={options.enabled}
            disabled={saving}
            onCheckedChange={(enabled) => save({ enabled })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
