import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./inertia/test/setup.ts'],
    include: ['inertia/**/*.test.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: {
      '~/': `${__dirname}/inertia/`,
      '@/': `${__dirname}/inertia/`,
    },
  },
})
