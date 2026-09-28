import { useCallback, useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete01Icon,
  Edit02Icon,
  LockPasswordIcon,
  UserIcon,
  UserShield01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsPage } from '@/components/settings/settings-page'
import { Section } from '@/components/settings/section'
import { RowGroup } from '@/components/settings/row-group'
import { EntityRow, type EntityRowAction } from '@/components/settings/entity-row'
import { LocalAccessSection } from '@/components/settings/local-access-section'
import { StatusBadge } from '@/components/status-badge'
import { getJson, send } from '@/components/system/system_api'
import { UserSheet, type UserSheetMode } from './user-sheet'
import { ResetPasswordDialog } from './reset-password-dialog'
import { addedOn, displayName, sortUsers, type UserEntry } from './users_api'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Hamster is unreachable.'
}

/**
 * Users & access: the sign-in policy first — it decides who even sees the
 * login — then every account. The page wraps this in the settings layout;
 * stories render it bare.
 */
export function UsersSettings({ currentUserId }: { currentUserId: string | null }) {
  const [users, setUsers] = useState<UserEntry[] | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ open: boolean; mode: UserSheetMode; session: number }>({
    open: false,
    mode: { kind: 'new' },
    session: 0,
  })
  const [resetting, setResetting] = useState<UserEntry | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await getJson<UserEntry[]>('/api/v1/users'))
      setUsersError(null)
    } catch (error) {
      setUsersError(`Accounts could not be loaded: ${errorText(error)}`)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const sorted = useMemo(() => (users ? sortUsers(users) : null), [users])

  const openSheet = (mode: UserSheetMode) =>
    setSheet((prev) => ({ open: true, mode, session: prev.session + 1 }))

  const deleteUser = async (user: UserEntry) => {
    try {
      await send(`/api/v1/users/${user.id}`, 'DELETE')
      toast.success(`${displayName(user)} deleted`)
    } catch (error) {
      toast.error(`${displayName(user)} not deleted`, { description: errorText(error) })
    } finally {
      void loadUsers()
    }
  }

  const admins = users?.filter((user) => user.isAdmin).length ?? 0
  const accountsDescription =
    users && users.length > 0
      ? `${users.length} ${users.length === 1 ? 'account' : 'accounts'} · ${admins} ${admins === 1 ? 'administrator' : 'administrators'}`
      : 'Administrators change settings and manage accounts; users browse and request.'

  return (
    <>
      <SettingsPage
        title="Users & access"
        description="Who can sign in, and whether this network is let in without a password."
        actions={
          <Button size="sm" onClick={() => openSheet({ kind: 'new' })}>
            <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
            Add user
          </Button>
        }
        ready={users !== null || usersError !== null}
      >
        <LocalAccessSection users={users} />

        <Section id="accounts" title="Accounts" description={accountsDescription}>
          <RowGroup
            loading={users === null && !usersError}
            error={usersError}
            onRetry={() => void loadUsers()}
            // The signed-in admin is always one of them, so empty means the list failed quietly.
            empty="No accounts came back. Reload, and check this account still has admin rights."
          >
            {(sorted ?? []).map((user) => {
              const isSelf = user.id === currentUserId
              const actions: EntityRowAction[] = [
                {
                  label: 'Edit',
                  icon: Edit02Icon,
                  onSelect: () => openSheet({ kind: 'edit', user }),
                },
                {
                  label: 'Reset password',
                  icon: LockPasswordIcon,
                  onSelect: () => setResetting(user),
                },
              ]
              if (!isSelf) {
                actions.push({
                  label: 'Delete',
                  icon: Delete01Icon,
                  destructive: true,
                  onSelect: () => deleteUser(user),
                  confirm: {
                    title: `Delete ${displayName(user)}?`,
                    description: 'They lose access at once. Media and history stay in the library.',
                    confirmLabel: 'Delete',
                  },
                })
              }
              return (
                <EntityRow
                  key={user.id}
                  icon={user.isAdmin ? UserShield01Icon : UserIcon}
                  name={displayName(user)}
                  status={
                    user.isAdmin ? (
                      <StatusBadge tone="neutral" label="Admin" icon={UserShield01Icon} />
                    ) : undefined
                  }
                  meta={[
                    isSelf ? 'you' : null,
                    user.fullName?.trim() ? user.email : null,
                    addedOn(user.createdAt),
                  ]}
                  onOpen={() => openSheet({ kind: 'edit', user })}
                  actions={actions}
                />
              )
            })}
          </RowGroup>
        </Section>
      </SettingsPage>

      <UserSheet
        key={sheet.session}
        open={sheet.open}
        mode={sheet.mode}
        currentUserId={currentUserId}
        onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
        onChanged={() => void loadUsers()}
      />
      <ResetPasswordDialog user={resetting} onOpenChange={(open) => !open && setResetting(null)} />
    </>
  )
}
