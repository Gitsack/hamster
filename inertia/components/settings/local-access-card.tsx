import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface LocalAccessOptions {
  enabled: boolean
  /** null means the first administrator account. */
  userId: string | null
}

export interface LocalAccessAccount {
  id: string
  fullName: string | null
  email: string
  isAdmin: boolean
}

/** Select items cannot carry null, so the default choice gets a stand-in value. */
const FIRST_ADMIN = 'first-admin'

/**
 * Whether the local network gets in without a login, and as whom.
 *
 * The account list comes from the page, which already loads it, so the choice
 * stays in step when accounts are added or removed there.
 */
export function LocalAccessCard({ users }: { users: LocalAccessAccount[] }) {
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
        setOptions({ userId: null, ...data.options })
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

  const accountName = (id: string) => {
    if (id === FIRST_ADMIN) return 'First administrator'
    const user = users.find((u) => u.id === id)
    return user ? user.fullName || user.email : 'Deleted account'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in</CardTitle>
        <CardDescription>
          On a home server, a login mostly gets in the way. Requests from your own network can skip
          it; anyone reaching Hamster from outside still has to sign in.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="local-access-enabled">No login from the local network</Label>
            <p className="text-muted-foreground text-xs">
              Behind a reverse proxy, it must pass the visitor&apos;s address on in X-Forwarded-For
              — most do by default.
            </p>
          </div>
          <Switch
            id="local-access-enabled"
            checked={options.enabled}
            disabled={saving}
            onCheckedChange={(enabled) => save({ ...options, enabled })}
          />
        </div>

        {users.length > 1 && (
          <div
            className={cn('space-y-2', !options.enabled && 'pointer-events-none opacity-50')}
            aria-hidden={!options.enabled}
          >
            <Label htmlFor="local-access-user">Local visitors use</Label>
            <Select
              value={options.userId ?? FIRST_ADMIN}
              onValueChange={(value) =>
                save({ ...options, userId: value === FIRST_ADMIN ? null : (value as string) })
              }
              disabled={saving || !options.enabled}
            >
              <SelectTrigger id="local-access-user" className="w-64">
                <SelectValue>{(value: string) => accountName(value)}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value={FIRST_ADMIN}>First administrator</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName || user.email}
                    {user.isAdmin ? ' (admin)' : ''}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <p className="text-muted-foreground text-xs">
              Pick an account without admin rights to keep the settings out of reach; an admin can
              still sign in from the account menu.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
