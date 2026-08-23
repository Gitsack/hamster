import { Head } from '@inertiajs/react'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Edit01Icon,
  Delete01Icon,
  LockPasswordIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface UserEntry {
  id: string
  fullName: string | null
  email: string
  isAdmin: boolean
  createdAt: string
}

export default function UsersSettings() {
  const [users, setUsers] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    password: '',
    isAdmin: false,
  })
  const [creating, setCreating] = useState(false)

  const [editingUser, setEditingUser] = useState<UserEntry | null>(null)
  const [editForm, setEditForm] = useState({ fullName: '', email: '', isAdmin: false })
  const [saving, setSaving] = useState(false)

  const [deletingUser, setDeletingUser] = useState<UserEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [resetUser, setResetUser] = useState<UserEntry | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/users')
      if (response.ok) {
        setUsers(await response.json())
      }
    } catch {
      toast.error('The user list could not be loaded — Hamster is unreachable. Reload to retry.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.fullName) {
      toast.error('Name, email and password are all required to create an account.')
      return
    }
    setCreating(true)
    try {
      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (response.ok) {
        toast.success('User created')
        setShowCreateDialog(false)
        setCreateForm({ fullName: '', email: '', password: '', isAdmin: false })
        fetchUsers()
      } else {
        const data = await response.json()
        toast.error(
          data.errors?.[0]?.message ||
            data.error ||
            'User not created — the server rejected the details. That email may already be in use.'
        )
      }
    } catch {
      toast.error('User not created — Hamster is unreachable. Check the server and try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      const response = await fetch(`/api/v1/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (response.ok) {
        toast.success('User updated')
        setEditingUser(null)
        fetchUsers()
      } else {
        const data = await response.json()
        toast.error(
          data.errors?.[0]?.message ||
            data.error ||
            'User not updated — the server rejected the change. Check the email is valid and unused.'
        )
      }
    } catch {
      toast.error('User not updated — Hamster is unreachable. Check the server and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/users/${deletingUser.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('User deleted')
        setDeletingUser(null)
        fetchUsers()
      } else {
        const data = await response.json()
        toast.error(data.error || 'User not deleted — the server refused the request. Try again.')
      }
    } catch {
      toast.error('User not deleted — Hamster is unreachable. Check the server and try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser) return
    if (!resetPassword || resetPassword.length < 8) {
      toast.error('The new password must be at least 8 characters.')
      return
    }
    setResetting(true)
    try {
      const response = await fetch(`/api/v1/users/${resetUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword }),
      })
      if (response.ok) {
        toast.success('Password reset successfully')
        setResetUser(null)
        setResetPassword('')
      } else {
        const data = await response.json()
        toast.error(
          data.error || 'Password not reset — the server rejected it. Try a longer password.'
        )
      }
    } catch {
      toast.error('Password not reset — Hamster is unreachable. Check the server and try again.')
    } finally {
      setResetting(false)
    }
  }

  const openEdit = (user: UserEntry) => {
    setEditingUser(user)
    setEditForm({
      fullName: user.fullName || '',
      email: user.email,
      isAdmin: user.isAdmin,
    })
  }

  return (
    <AppLayout title="User Management">
      <Head title="User Management" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle>Accounts</CardTitle>
                <CardDescription>
                  Everyone who can sign in to this install. Administrators can change settings and
                  manage other accounts; users can only browse and request.
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateDialog(true)} className="sm:shrink-0">
                <HugeiconsIcon icon={Add01Icon} />
                Add user
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <HugeiconsIcon
                    icon={UserGroupIcon}
                    className="size-6 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-lg font-medium">No accounts listed</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Nothing came back from the server. Reload the page, and if the list stays empty
                  check that this account still has administrator rights.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-24">Role</TableHead>
                    <TableHead data-numeric className="w-32">
                      Created
                    </TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.fullName || <span className="text-muted-foreground">No name</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge>Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </TableCell>
                      <TableCell data-numeric className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${user.fullName || user.email}`}
                            onClick={() => openEdit(user)}
                          >
                            <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Reset password for ${user.fullName || user.email}`}
                            onClick={() => {
                              setResetUser(user)
                              setResetPassword('')
                            }}
                          >
                            <HugeiconsIcon icon={LockPasswordIcon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${user.fullName || user.email}`}
                            onClick={() => setDeletingUser(user)}
                          >
                            <HugeiconsIcon
                              icon={Delete01Icon}
                              className="size-4 text-destructive"
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              The account can sign in immediately. Tell the person their password yourself — Hamster
              does not send mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Full Name</Label>
                <Input
                  id="create-name"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  autoComplete="off"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="At least 8 characters"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-6">
              <Checkbox
                id="create-admin"
                checked={createForm.isAdmin}
                onCheckedChange={(checked) =>
                  setCreateForm({ ...createForm, isAdmin: checked === true })
                }
              />
              <Label htmlFor="create-admin" className="cursor-pointer font-normal">
                Administrator — can change settings and manage accounts
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Spinner />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Changing the email changes the address this person signs in with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-6">
              <Checkbox
                id="edit-admin"
                checked={editForm.isAdmin}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isAdmin: checked === true })
                }
              />
              <Label htmlFor="edit-admin" className="cursor-pointer font-normal">
                Administrator — can change settings and manage accounts
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Spinner />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              {deletingUser?.fullName || deletingUser?.email} loses access immediately. Media and
              history stay in the library. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Spinner />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Sets a new password for {resetUser?.fullName || resetUser?.email}. Pass it on yourself
              — Hamster does not send mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting && <Spinner />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
