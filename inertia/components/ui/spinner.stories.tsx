import type { Meta, StoryObj } from '@storybook/react'
import { Spinner } from './spinner'

const meta: Meta<typeof Spinner> = {
  component: Spinner,
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof Spinner>

export const Default: Story = {}

export const Small: Story = {
  args: {
    className: 'size-3',
  },
}

export const Medium: Story = {
  args: {
    className: 'size-6',
  },
}

export const Large: Story = {
  args: {
    className: 'size-8',
  },
}

export const ExtraLarge: Story = {
  args: {
    className: 'size-12',
  },
}

export const CustomColor: Story = {
  args: {
    className: 'size-6 text-destructive',
  },
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-3" />
      <Spinner />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
      <Spinner className="size-12" />
    </div>
  ),
}
