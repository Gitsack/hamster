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
import { Add01Icon, Edit01Icon, Delete01Icon, LockPasswordIcon } from '@hugeicons/core-free-icons'
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
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.fullName) {
      toast.error('Please fill in all required fields')
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
        toast.error(data.errors?.[0]?.message || data.error || 'Failed to create user')
      }
    } catch {
      toast.error('Failed to create user')
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
        toast.error(data.errors?.[0]?.message || data.error || 'Failed to update user')
      }
    } catch {
      toast.error('Failed to update user')
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
        toast.error(data.error || 'Failed to delete user')
      }
    } catch {
      toast.error('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser) return
    if (!resetPassword || resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
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
        toast.error(data.error || 'Failed to reset password')
      }
    } catch {
      toast.error('Failed to reset password')
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage user accounts and permissions.</CardDescription>
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.fullName || <span className="text-muted-foreground">No name</span>}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge className="bg-primary">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                            <HugeiconsIcon icon={Edit01Icon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setResetUser(user)
                              setResetPassword('')
                            }}
                          >
                            <HugeiconsIcon icon={LockPasswordIcon} className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingUser(user)}
                          >
                            <HugeiconsIcon icon={Delete01Icon} className="size-4 text-destructive" />
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
            <DialogDescription>Add a new user account.</DialogDescription>
          </DialogHeader>
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
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-admin"
                checked={createForm.isAdmin}
                onCheckedChange={(checked) =>
                  setCreateForm({ ...createForm, isAdmin: checked === true })
                }
              />
              <Label htmlFor="create-admin">Administrator</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Spinner className="mr-2" />}
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
            <DialogDescription>Update user account details.</DialogDescription>
          </DialogHeader>
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-admin"
                checked={editForm.isAdmin}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isAdmin: checked === true })
                }
              />
              <Label htmlFor="edit-admin">Administrator</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Spinner className="mr-2" />}
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
              Are you sure you want to delete {deletingUser?.fullName || deletingUser?.email}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Spinner className="mr-2" />}
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
              Set a new password for {resetUser?.fullName || resetUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting && <Spinner className="mr-2" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
