import type { StorybookConfig } from '@storybook/react-vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../inertia/components/**/*.stories.@(ts|tsx)'],

  viteFinal(config) {
    config.resolve ??= {}
    config.resolve.alias = {
      ...config.resolve.alias,
      '~/': `${resolve(__dirname, '../inertia')}/`,
      '@/': `${resolve(__dirname, '../inertia')}/`,
    }
    return config
  },
}

export default config
