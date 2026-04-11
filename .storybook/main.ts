import type { StorybookConfig } from '@storybook/react-vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../inertia/components/**/*.stories.@(ts|tsx)'],

  viteFinal(viteConfig) {
    viteConfig.resolve ??= {}
    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      '~/': `${resolve(rootDir, '../inertia')}/`,
      '@/': `${resolve(rootDir, '../inertia')}/`,
    }
    return viteConfig
  },
}

export default config
