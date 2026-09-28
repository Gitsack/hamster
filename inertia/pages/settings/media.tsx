import { useEffect } from 'react'
import { router } from '@inertiajs/react'
import { SettingsLayout } from '@/components/layout/settings-layout'
import { MediaSettings } from '@/components/library-settings/media-settings'

/**
 * Anchors that lived on the old Media Management page and now have pages of
 * their own. /settings/media-management redirects here and the browser keeps
 * the fragment, so a bookmarked #quality or #discovery is sent on.
 */
const MOVED_ANCHORS: Record<string, string> = {
  '#quality': '/settings/quality',
  '#discovery': '/settings/discovery',
}

/**
 * Settings → Media: media types and folders, file naming, import clean-up and
 * playback. /settings/media-management and /settings/playback redirect here.
 */
export default function Media() {
  useEffect(() => {
    const moved = MOVED_ANCHORS[window.location.hash]
    if (moved) router.visit(moved, { replace: true })
  }, [])

  return (
    <SettingsLayout>
      <MediaSettings />
    </SettingsLayout>
  )
}
