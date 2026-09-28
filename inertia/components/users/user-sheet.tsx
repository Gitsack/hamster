import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { SheetSection } from '@/components/settings/field-group'
import { EditorSheet, SheetField, SheetSwitch } from '@/components/settings/editor-sheet'
import { send } from '@/components/system/system_api'
import { MIN_PASSWORD_LENGTH, displayName, type UserEntry } from './users_api'

export type UserSheetMode = { kind: 'new' } | { kind: 'edit'; user: UserEntry }

interface Draft {
  fullName: string
  email: string
  password: string
  isAdmin: boolean
}

type Errors = Partial<Record<'fullName' | 'email' | 'password', string>>

function validate(draft: Draft, creating: boolean, nameRequired: boolean): Errors {
  const errors: Errors = {}
  const name = draft.fullName.trim()
  if (nameRequired && !name) errors.fullName = 'A name is required.'
  else if (name && name.length < 2) errors.fullName = 'At least 2 characters.'
  if (!draft.email.trim()) errors.email = 'An email address is required.'
  else if (!/^[^\s@]+@[^\s@]+$/.test(draft.email.trim()))
    errors.email = 'That is not an email address.'
  if (creating && draft.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `At least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return errors
}

interface UserSheetProps {
  open: boolean
  mode: UserSheetMode
  /** The signed-in account, which cannot delete itself. */
  currentUserId: string | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

/** Create an account, or change one's name, address and role. */
export function UserSheet({ open, mode, currentUserId, onOpenChange, onChanged }: UserSheetProps) {
  const user = mode.kind === 'edit' ? mode.user : null
  const creating = user === null
  const isSelf = user !== null && user.id === currentUserId
  // A name can be changed but, once set, not removed: the server keeps one of 2+ characters.
  const nameRequired = creating || Boolean(user?.fullName?.trim())
  // The parent remounts this per opening (key), so the initial state is the reset.
  const [draft, setDraft] = useState<Draft>({
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    password: '',
    isAdmin: user?.isAdmin ?? false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setError(null)
  }

  const save = async () => {
    const found = validate(draft, creating, nameRequired)
    if (Object.values(found).some(Boolean)) {
      setErrors(found)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (user) {
        await send(`/api/v1/users/${user.id}`, 'PUT', {
          fullName: draft.fullName.trim() || undefined,
          email: draft.email.trim(),
          isAdmin: draft.isAdmin,
        })
        toast.success(`${draft.fullName.trim() || draft.email.trim()} saved`)
      } else {
        await send('/api/v1/users', 'POST', {
          fullName: draft.fullName.trim(),
          email: draft.email.trim(),
          password: draft.password,
          isAdmin: draft.isAdmin,
        })
        toast.success(`${draft.fullName.trim()} can sign in now`)
      }
      onChanged()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The account was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!user) return
    try {
      await send(`/api/v1/users/${user.id}`, 'DELETE')
      toast.success(`${displayName(user)} deleted`)
      onChanged()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The account was not deleted.')
    }
  }

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={user ? displayName(user) : 'Add user'}
      description={
        creating
          ? 'They can sign in straight away. Pass the password on yourself: Hamster sends no mail.'
          : 'Changing the email changes the address this person signs in with.'
      }
      error={error}
      onSave={save}
      saveLabel={creating ? 'Add' : 'Save'}
      saving={saving}
      onDelete={user && !isSelf ? remove : undefined}
      deleteConfirm={{
        title: `Delete ${user ? displayName(user) : 'account'}?`,
        description: 'They lose access at once. Media and history stay in the library.',
      }}
    >
      <SheetSection title="Account">
        <SheetField label="Full name" optional={!nameRequired} error={errors.fullName}>
          {(props) => (
            <Input
              {...props}
              value={draft.fullName}
              onChange={(event) => update('fullName', event.target.value)}
              autoComplete="off"
            />
          )}
        </SheetField>
        <SheetField label="Email" error={errors.email}>
          {(props) => (
            <Input
              {...props}
              type="email"
              value={draft.email}
              onChange={(event) => update('email', event.target.value)}
              autoComplete="off"
              placeholder="name@example.com"
            />
          )}
        </SheetField>
        {creating && (
          <SheetField label="Password" error={errors.password}>
            {(props) => (
              <Input
                {...props}
                type="password"
                value={draft.password}
                onChange={(event) => update('password', event.target.value)}
                autoComplete="new-password"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              />
            )}
          </SheetField>
        )}
      </SheetSection>
      <SheetSection title="Role">
        <SheetSwitch
          label="Administrator"
          description="Can change settings and manage accounts. Users browse and request."
          checked={draft.isAdmin}
          onCheckedChange={(checked) => update('isAdmin', checked)}
        />
      </SheetSection>
    </EditorSheet>
  )
}
