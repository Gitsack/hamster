import { Head, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun03Icon, Moon02Icon, ComputerIcon } from '@hugeicons/core-free-icons'
import { useTheme, type Theme } from '@/contexts/theme_context'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun03Icon; hint: string }[] = [
  { value: 'light', label: 'Light', icon: Sun03Icon, hint: 'Always light' },
  { value: 'dark', label: 'Dark', icon: Moon02Icon, hint: 'Always dark' },
  { value: 'system', label: 'System', icon: ComputerIcon, hint: 'Follow this device' },
]

export default function UISettings() {
  const { props } = usePage<{
    user?: { id: string; fullName?: string; email: string; isAdmin: boolean }
    version: string
  }>()
  const { user, version } = props

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const { theme, setTheme } = useTheme()
  // The stored preference is only known on the client; gate the selected state
  // on mount so the server-rendered markup and the first client render agree.
  const [themeReady, setThemeReady] = useState(false)
  useEffect(() => setThemeReady(true), [])
  const selectedTheme = themeReady ? theme : null

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const response = await fetch('/api/v1/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName }),
      })
      if (response.ok) {
        toast.success('Profile updated')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Profile not saved — the server rejected the change.')
      }
    } catch {
      toast.error('Profile not saved — Hamster is unreachable. Check the server and try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all password fields')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setSavingPassword(true)
    try {
      const response = await fetch('/api/v1/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (response.ok) {
        toast.success('Password changed')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Password not changed — check your current password.')
      }
    } catch {
      toast.error('Password not changed — Hamster is unreachable. Check the server and try again.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <AppLayout title="Profile Settings">
      <Head title="Profile Settings" />

      <div className="max-w-2xl space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              The address you sign in with and the name shown beside your activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ''} disabled />
                <p className="text-xs text-muted-foreground">
                  Your sign-in address. It cannot be changed from this screen.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Display Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile && <Spinner />}
                Save Profile
              </Button>
              {user?.isAdmin && <Badge>Admin</Badge>}
              <span className="readout text-xs text-muted-foreground">Hamster v{version}</span>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Which theme this browser renders in. Stored on this device, not on your account, so
              each machine can differ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset>
              <legend className="sr-only">Theme</legend>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((option) => {
                  const selected = selectedTheme === option.value
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-3 py-4 text-center transition-colors duration-150',
                        'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                        selected
                          ? 'border-primary bg-accent text-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={option.value}
                        checked={selected}
                        onChange={() => setTheme(option.value)}
                        className="sr-only"
                      />
                      <HugeiconsIcon icon={option.icon} size={20} strokeWidth={1.5} />
                      <span className={cn('text-sm', selected ? 'font-medium' : 'font-normal')}>
                        {option.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{option.hint}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Replace the password for this account. Minimum eight characters; you stay signed in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat the new password"
                />
              </div>
            </div>
            <Button onClick={changePassword} disabled={savingPassword}>
              {savingPassword && <Spinner />}
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
