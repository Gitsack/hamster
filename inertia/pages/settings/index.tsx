import { usePage } from '@inertiajs/react'
import { SettingsLayout } from '@/components/layout/settings-layout'
import { SettingsOverviewList } from '@/components/settings/settings-overview'
import type { SettingsOverview } from '@/components/settings/settings_overview'

/**
 * /settings for admins (everyone else is redirected to Profile): the grouped
 * list of settings pages with a live status line each. Replaces the old
 * redirect to Media Management, and is the drill-in list on phones.
 */
export default function SettingsIndex({ overview }: { overview: SettingsOverview | null }) {
  const { props } = usePage<{ user?: { email?: string } }>()

  return (
    <SettingsLayout>
      <SettingsOverviewList overview={overview} email={props.user?.email} />
    </SettingsLayout>
  )
}
