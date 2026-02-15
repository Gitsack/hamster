import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { getDirname } from '@adonisjs/core/helpers'

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
      '~/': `${getDirname(import.meta.url)}/inertia/`,
      '@/': `${getDirname(import.meta.url)}/inertia/`,
    },
  },
})
