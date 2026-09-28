import { SettingsLayout } from '@/components/layout/settings-layout'
import { NotificationsSettings } from '@/components/notifications/notifications-settings'

/**
 * Settings → Notifications: push services and webhooks as one list of targets,
 * plus the delivery log. /settings/webhooks and /system/events redirect here.
 */
export default function Notifications() {
  return (
    <SettingsLayout>
      <NotificationsSettings />
    </SettingsLayout>
  )
}
