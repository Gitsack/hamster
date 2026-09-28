import { usePage } from '@inertiajs/react'
import { SettingsLayout } from '@/components/layout/settings-layout'
import { UsersSettings } from '@/components/users/users-settings'

/**
 * Settings → Users & access: the sign-in policy (#sign-in), then every
 * account (#accounts).
 */
export default function Users() {
  const { props } = usePage<{ user?: { id: string } }>()
  return (
    <SettingsLayout>
      <UsersSettings currentUserId={props.user?.id ?? null} />
    </SettingsLayout>
  )
}
