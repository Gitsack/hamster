import type { StorybookConfig } from '@storybook/react-vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../inertia/components/**/*.stories.@(ts|tsx)'],

  viteFinal(viteConfig) {
    viteConfig.resolve ??= {}
    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      '~/': `${resolve(__dirname, '../inertia')}/`,
      '@/': `${resolve(__dirname, '../inertia')}/`,
    }
    return viteConfig
  },
}

export default config
