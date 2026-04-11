/// <reference path="../adonisrc.ts" />
/// <reference path="../config/inertia.ts" />

import './css/app.css'
import { hydrateRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { ActiveDownloadsProvider } from '@/contexts/active_downloads_context'
import { AudioPlayerProvider } from '@/contexts/audio_player_context'
import { MediaPreviewProvider } from '@/contexts/media_preview_context'
import { AudioPlayer } from '@/components/player/audio_player'
import { OperationTrackerProvider } from '@/components/operation-tracker'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from 'sonner'
import { useState, useEffect } from 'react'

const appName = import.meta.env.VITE_APP_NAME || 'Hamster'

function ClientOnlyToaster() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return <Toaster position="bottom-right" />
}

createInertiaApp({
  progress: { color: '#5468FF' },

  title: (title) => `${title} - ${appName}`,

  resolve: (name) => {
    return resolvePageComponent(
      `./pages/${name}.tsx`,
      import.meta.glob('./pages/**/!(*.test|*.spec).tsx')
    )
  },

  setup({ el, App, props }) {
    hydrateRoot(
      el,
      <ErrorBoundary fullPage>
        <ActiveDownloadsProvider>
          <AudioPlayerProvider>
            <OperationTrackerProvider>
              <MediaPreviewProvider>
                <App {...props} />
                <AudioPlayer />
                <ClientOnlyToaster />
              </MediaPreviewProvider>
            </OperationTrackerProvider>
          </AudioPlayerProvider>
        </ActiveDownloadsProvider>
      </ErrorBoundary>
    )
  },
})
