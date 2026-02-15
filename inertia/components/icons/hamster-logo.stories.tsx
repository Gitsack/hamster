import type { Meta, StoryObj } from '@storybook/react'
import { HamsterLogo } from './hamster-logo'

const meta: Meta<typeof HamsterLogo> = {
  component: HamsterLogo,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof HamsterLogo>

export const Default: Story = {
  args: {},
}

export const Small: Story = {
  args: {
    size: 'sm',
  },
}

export const Medium: Story = {
  args: {
    size: 'md',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
  },
}

export const IconOnly: Story = {
  name: 'Icon Only (no text)',
  args: {
    showText: false,
    size: 'md',
  },
}

export const IconOnlySmall: Story = {
  name: 'Icon Only - Small',
  args: {
    showText: false,
    size: 'sm',
  },
}

export const IconOnlyLarge: Story = {
  name: 'Icon Only - Large',
  args: {
    showText: false,
    size: 'lg',
  },
}

export const OnDarkBackground: Story = {
  name: 'On Dark Background',
  decorators: [
    (Story) => (
      <div
        style={{
          padding: '2rem',
          backgroundColor: '#1a1a2e',
          color: '#ffffff',
          borderRadius: '8px',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    size: 'lg',
  },
}

export const AllSizes: Story = {
  name: 'All Sizes',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <HamsterLogo size="sm" />
      <HamsterLogo size="md" />
      <HamsterLogo size="lg" />
    </div>
  ),
}
