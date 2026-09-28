import { SettingsLayout } from '@/components/layout/settings-layout'
import { IndexersSettings } from '@/components/indexers/indexers-settings'

/**
 * Settings → Indexers: Prowlarr (#prowlarr) and direct Newznab indexers (#direct).
 */
export default function Indexers() {
  return (
    <SettingsLayout>
      <IndexersSettings />
    </SettingsLayout>
  )
}
