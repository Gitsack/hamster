import type { Preview } from '@storybook/react'
import '../inertia/css/app.css'

const preview: Preview = {
  // Every surface is specified in both ramps (DESIGN.md), so every story can be
  // flipped between them from the toolbar. The body already paints
  // bg-background, so the canvas follows the theme with no backgrounds addon.
  globalTypes: {
    theme: {
      description: 'Colour ramp',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [
    (Story, context) => {
      // On <html> rather than a wrapper so portalled dialogs, menus and sheets follow too.
      document.documentElement.classList.toggle('dark', context.globals.theme === 'dark')
      return Story()
    },
  ],
  parameters: {
    layout: 'centered',
    viewport: {
      options: {
        phone: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
        tablet: {
          name: 'Tablet 768',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        desktop: {
          name: 'Desktop 1440',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
  },
}

export default preview
