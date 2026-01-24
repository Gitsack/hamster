/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import '../css/app.css'
import { hydrateRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { AudioPlayerProvider } from '@/contexts/audio_player_context'
import { AudioPlayer } from '@/components/player/audio_player'
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
    return resolvePageComponent(`../pages/${name}.tsx`, import.meta.glob('../pages/**/*.tsx'))
  },

  setup({ el, App, props }) {
    hydrateRoot(
      el,
      <AudioPlayerProvider>
        <App {...props} />
        <AudioPlayer />
        <ClientOnlyToaster />
      </AudioPlayerProvider>
    )
  },
})
