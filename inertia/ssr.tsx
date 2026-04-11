import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { ActiveDownloadsProvider } from '@/contexts/active_downloads_context'
import { AudioPlayerProvider } from '@/contexts/audio_player_context'
import { MediaPreviewProvider } from '@/contexts/media_preview_context'
import { OperationTrackerProvider } from '@/components/operation-tracker'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('./pages/**/!(*.test|*.spec).tsx', { eager: true })
      return pages[`./pages/${name}.tsx`]
    },
    setup: ({ App, props }) => (
      <ActiveDownloadsProvider>
        <AudioPlayerProvider>
          <OperationTrackerProvider>
            <MediaPreviewProvider>
              <App {...props} />
            </MediaPreviewProvider>
          </OperationTrackerProvider>
        </AudioPlayerProvider>
      </ActiveDownloadsProvider>
    ),
  })
}
