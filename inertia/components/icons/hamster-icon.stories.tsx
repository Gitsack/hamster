import type { Meta, StoryObj } from '@storybook/react'
import { HamsterIcon } from './hamster-icon'

const meta: Meta<typeof HamsterIcon> = {
  component: HamsterIcon,
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

type Story = StoryObj<typeof HamsterIcon>

export const Default: Story = {
  args: {
    className: 'h-16 w-16',
  },
}

export const Small: Story = {
  args: {
    className: 'h-6 w-6',
  },
}

export const Large: Story = {
  args: {
    className: 'h-32 w-32',
  },
}

export const Colored: Story = {
  name: 'Custom Color',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', color: '#e67e22' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    className: 'h-20 w-20',
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
    className: 'h-20 w-20',
  },
}
