import { SettingsLayout } from '@/components/layout/settings-layout'
import { DownloadClientsSettings } from '@/components/download-clients/download-clients-settings'

/**
 * Settings → Download clients. Browsing a client's folder and manual import
 * live in Activity → Imports; each row links there.
 */
export default function DownloadClients() {
  return (
    <SettingsLayout>
      <DownloadClientsSettings />
    </SettingsLayout>
  )
}
