import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { ActiveDownloadsProvider } from '@/contexts/active_downloads_context'
import { AudioPlayerProvider } from '@/contexts/audio_player_context'
import { MediaPreviewProvider } from '@/contexts/media_preview_context'
import { OperationTrackerProvider } from '@/components/operation-tracker'
import { ThemeProvider } from '@/contexts/theme_context'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('./pages/**/!(*.test|*.spec).tsx', { eager: true })
      return pages[`./pages/${name}.tsx`]
    },
    // Same provider stack as inertia/app.tsx — a component that reads the theme
    // during render must resolve identically on the server and on hydration.
    setup: ({ App, props }) => (
      <ThemeProvider>
        <ActiveDownloadsProvider>
          <AudioPlayerProvider>
            <OperationTrackerProvider>
              <MediaPreviewProvider>
                <App {...props} />
              </MediaPreviewProvider>
            </OperationTrackerProvider>
          </AudioPlayerProvider>
        </ActiveDownloadsProvider>
      </ThemeProvider>
    ),
  })
}
