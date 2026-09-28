import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { send } from '@/components/system/system_api'
import { MIN_PASSWORD_LENGTH, displayName, type UserEntry } from './users_api'

/** Single-field entry: a new password for someone else's account. */
export function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  /** The account being reset; null closes the dialog. */
  user: UserEntry | null
  onOpenChange: (open: boolean) => void
}) {
  const inputId = useId()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setPassword('')
    setError(null)
    setSaving(false)
  }, [user])

  const submit = async () => {
    if (!user || saving) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`At least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await send(`/api/v1/users/${user.id}/reset-password`, 'POST', { newPassword: password })
      toast.success(`Password reset for ${displayName(user)}`)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The password was not reset.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent aria-labelledby={`${inputId}-title`}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle id={`${inputId}-title`}>Reset password</DialogTitle>
            <DialogDescription>
              A new password for {user ? displayName(user) : 'this account'}. Pass it on yourself:
              Hamster sends no mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block text-sm font-medium">
              New password
            </label>
            <Input
              id={inputId}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(null)
              }}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            {error && (
              <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
