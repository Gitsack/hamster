import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import { AudioPlayerProvider } from '@/contexts/audio_player_context'
import { MediaPreviewProvider } from '@/contexts/media_preview_context'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: ReactDOMServer.renderToString,
    resolve: (name) => {
      const pages = import.meta.glob('../pages/**/*.tsx', { eager: true })
      return pages[`../pages/${name}.tsx`]
    },
    setup: ({ App, props }) => (
      <AudioPlayerProvider>
        <MediaPreviewProvider>
          <App {...props} />
        </MediaPreviewProvider>
      </AudioPlayerProvider>
    ),
  })
}
