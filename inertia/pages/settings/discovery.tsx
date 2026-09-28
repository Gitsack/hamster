import { SettingsLayout } from '@/components/layout/settings-layout'
import { DiscoverySettings } from '@/components/library-settings/discovery-settings'

/**
 * Settings → Discovery: metadata credentials, region, Search lane sources,
 * connected accounts and streaming services.
 */
export default function Discovery() {
  return (
    <SettingsLayout>
      <DiscoverySettings />
    </SettingsLayout>
  )
}
