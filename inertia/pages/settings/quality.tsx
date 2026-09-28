import { router, usePage } from '@inertiajs/react'
import { SettingsLayout } from '@/components/layout/settings-layout'
import { QualitySettings } from '@/components/library-settings/quality-settings'
import { qualityUrl, typeFromUrl } from '@/components/library-settings/library_catalog'

/**
 * Settings → Quality: quality profiles per media type (?type=movies|tv|music|books)
 * and custom formats. Switching type swaps the URL without a request.
 */
export default function Quality() {
  const { url } = usePage()

  return (
    <SettingsLayout>
      <QualitySettings
        type={typeFromUrl(url)}
        onTypeChange={(type) =>
          router.replace({ url: qualityUrl(type), preserveState: true, preserveScroll: true })
        }
      />
    </SettingsLayout>
  )
}
