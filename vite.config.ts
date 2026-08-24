import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import inertia from '@adonisjs/inertia/vite'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'
import tailwindcss from '@tailwindcss/vite'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    tailwindcss(),
    inertia({ ssr: { enabled: true, entrypoint: 'inertia/ssr.tsx' } }),
    react(),
    adonisjs({ entrypoints: ['inertia/app.tsx'], reload: ['resources/views/**/*.edge'] }),
  ],

  /**
   * Pre-declare every dependency the client can reach.
   *
   * Left to discovery, Vite re-optimizes the moment an edit adds or removes an
   * import — it rewrites module URLs with a new ?v= hash while the running
   * server still serves the old one from its module graph. The browser then
   * loads two copies of React, and every component that touches a context dies
   * with "dispatcher is null". Declaring the set makes it stable across edits,
   * so a change to which file imports a Switch cannot invalidate the graph.
   */
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      '@base-ui/react/accordion',
      '@base-ui/react/checkbox',
      '@base-ui/react/collapsible',
      '@base-ui/react/menu',
      '@base-ui/react/progress',
      '@base-ui/react/scroll-area',
      '@base-ui/react/select',
      '@base-ui/react/separator',
      '@base-ui/react/slider',
      '@base-ui/react/switch',
      '@base-ui/react/tabs',
      '@base-ui/react/tooltip',
    ],
  },

  /**
   * Define aliases for importing modules from
   * your frontend code
   */
  resolve: {
    alias: {
      '~/': `${rootDir}/inertia/`,
      '@/': `${rootDir}/inertia/`,
    },
  },
})
