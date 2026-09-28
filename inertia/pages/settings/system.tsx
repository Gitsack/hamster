import { SettingsLayout } from '@/components/layout/settings-layout'
import { SystemSettings } from '@/components/system/system-settings'

/**
 * Settings → System: health, scheduled tasks, backups and About.
 * /system/status redirects here (#health).
 */
export default function System() {
  return (
    <SettingsLayout>
      <SystemSettings />
    </SettingsLayout>
  )
}
