import { Head, usePage } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useState } from 'react'
import { toast } from 'sonner'

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
        toast.error(data.error || 'Failed to update profile')
      }
    } catch {
      toast.error('Failed to update profile')
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
        toast.error(data.error || 'Failed to change password')
      }
    } catch {
      toast.error('Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <AppLayout title="Profile Settings">
      <Head title="Profile Settings" />

      <div className="space-y-6 max-w-2xl">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account information and display name.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ''} disabled />
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
            <div className="flex items-center gap-2">
              {user?.isAdmin && <Badge className="bg-primary">Admin</Badge>}
              <span className="text-xs text-muted-foreground">Hamster v{version}</span>
            </div>
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile && <Spinner className="mr-2" />}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <Button onClick={changePassword} disabled={savingPassword}>
              {savingPassword && <Spinner className="mr-2" />}
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
