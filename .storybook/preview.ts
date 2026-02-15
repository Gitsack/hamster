import type { Preview } from '@storybook/react'
import '../inertia/css/app.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a2e' },
      ],
    },
    layout: 'centered',
  },
}

export default preview
