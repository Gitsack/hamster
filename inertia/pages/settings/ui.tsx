import { useEffect, useState, type FormEvent } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { ComputerIcon, Login01Icon, Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { SettingsLayout } from '@/components/layout/settings-layout'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { FieldRow, ReadoutRow, SettingRow } from '@/components/settings/setting-row'
import { SaveBar, useFormDraft } from '@/components/settings/save-bar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { send } from '@/components/system/system_api'
import { useTheme, type Theme } from '@/contexts/theme_context'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun03Icon }[] = [
  { value: 'system', label: 'System', icon: ComputerIcon },
  { value: 'light', label: 'Light', icon: Sun03Icon },
  { value: 'dark', label: 'Dark', icon: Moon02Icon },
]

const MIN_PASSWORD_LENGTH = 8

interface ProfileUser {
  id: string
  fullName?: string | null
  email: string
  isAdmin: boolean
  autoSignedIn?: boolean
}

/**
 * Settings → Profile (/settings/profile; /settings/ui redirects here). The one
 * settings page every account has: its name (#account), how Hamster looks on
 * this device (#appearance) and its password (#password).
 */
export default function UISettings() {
  const { props } = usePage<{ user?: ProfileUser }>()
  const { user } = props

  const profile = useFormDraft({ fullName: user?.fullName ?? '' })

  const saveProfile = () =>
    void profile.save(async ({ fullName }) => {
      await send('/api/v1/user/profile', 'PUT', { fullName: fullName.trim() })
      toast.success('Profile updated')
      // The sidebar shows the name too.
      router.reload({ only: ['user'] })
    })

  return (
    <SettingsLayout>
      <SettingsPage
        title="Profile"
        description="Your account, how Hamster looks on this device, and your password."
      >
        <Section id="account" title="Account">
          <RowGroup>
            <ReadoutRow
              label="Email"
              description="The address you sign in with."
              value={user?.email ?? ''}
            />
            <FieldRow
              label="Display name"
              description="Shown in the sidebar and beside your activity."
              value={profile.draft.fullName}
              onChange={(value) => profile.set('fullName', value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={255}
            />
            <ReadoutRow
              label="Role"
              description={
                user?.isAdmin
                  ? 'Can change settings and manage accounts.'
                  : 'Can browse and request. An administrator manages settings.'
              }
              value={user?.isAdmin ? 'Admin' : 'User'}
              mono={false}
            />
          </RowGroup>
        </Section>

        <Section id="appearance" title="Appearance">
          <RowGroup>
            <ThemeRow />
          </RowGroup>
        </Section>

        <Section id="password" title="Password">
          {user?.autoSignedIn ? <LocalAccessPasswordNote /> : <PasswordForm />}
        </Section>

        <SaveBar
          dirty={profile.dirty}
          saving={profile.saving}
          error={profile.error}
          onSave={saveProfile}
          onDiscard={profile.discard}
        />
      </SettingsPage>
    </SettingsLayout>
  )
}

/** Which theme this browser renders in. Stored per device, so it applies at once. */
function ThemeRow() {
  const { theme, setTheme } = useTheme()
  // The stored preference is only known on the client; gate the selected state
  // on mount so the server-rendered markup and the first client render agree.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const selected = ready ? theme : null

  return (
    <SettingRow
      stack
      label="Theme"
      labelId="theme-label"
      description="Stored on this device, not your account, so each machine can differ."
      control={
        <div
          role="radiogroup"
          aria-labelledby="theme-label"
          className="grid grid-cols-3 rounded-lg border border-border bg-muted/40 p-0.5"
        >
          {THEME_OPTIONS.map((option) => {
            const checked = selected === option.value
            return (
              <label
                key={option.value}
                className={cn(
                  'flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm transition-colors duration-150',
                  'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                  checked
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={checked}
                  onChange={() => setTheme(option.value)}
                  className="sr-only"
                />
                <HugeiconsIcon icon={option.icon} aria-hidden="true" className="size-4" />
                {option.label}
              </label>
            )
          })}
        </div>
      }
    />
  )
}

/** Let in by local access: there is no password session to prove who this is. */
function LocalAccessPasswordNote() {
  return (
    <RowGroup>
      <SettingRow
        label="Signed in by local access"
        description="Sign in with a password to change it."
        control={
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">
              <HugeiconsIcon icon={Login01Icon} aria-hidden="true" />
              Sign in
            </Link>
          </Button>
        }
      />
    </RowGroup>
  )
}

type PasswordErrors = Partial<Record<'current' | 'next' | 'confirm' | 'form', string>>

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [saving, setSaving] = useState(false)

  const clear = (key: keyof PasswordErrors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found: PasswordErrors = {}
    if (!current) found.current = 'Enter your current password.'
    if (!next) found.next = 'Enter a new password.'
    else if (next.length < MIN_PASSWORD_LENGTH) {
      found.next = `At least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (next && confirm !== next) found.confirm = 'Does not match the new password.'
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }

    setSaving(true)
    setErrors({})
    try {
      await send('/api/v1/user/password', 'PUT', { currentPassword: current, newPassword: next })
      toast.success('Password changed')
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The password was not changed.'
      if (/current password/i.test(message)) setErrors({ current: message })
      else setErrors({ form: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <RowGroup>
        <FieldRow
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(value) => {
            setCurrent(value)
            clear('current')
          }}
          error={errors.current}
        />
        <FieldRow
          label="New password"
          description={`At least ${MIN_PASSWORD_LENGTH} characters. You stay signed in.`}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(value) => {
            setNext(value)
            clear('next')
          }}
          error={errors.next}
        />
        <FieldRow
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(value) => {
            setConfirm(value)
            clear('confirm')
          }}
          error={errors.confirm}
        />
        <div className="flex min-h-14 flex-wrap items-center justify-end gap-x-4 gap-y-2 px-4 py-3">
          {errors.form && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Spinner />}
            Change password
          </Button>
        </div>
      </RowGroup>
    </form>
  )
}
