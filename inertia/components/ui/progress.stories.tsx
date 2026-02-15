import type { Meta, StoryObj } from '@storybook/react'
import { Progress } from './progress'

const meta: Meta<typeof Progress> = {
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof Progress>

export const Default: Story = {
  args: {
    value: 50,
  },
}

export const Empty: Story = {
  args: {
    value: 0,
  },
}

export const Quarter: Story = {
  args: {
    value: 25,
  },
}

export const Half: Story = {
  args: {
    value: 50,
  },
}

export const ThreeQuarters: Story = {
  args: {
    value: 75,
  },
}

export const Complete: Story = {
  args: {
    value: 100,
  },
}

export const AllStages: Story = {
  args: {
    value: 57,
  },

  render: () => (
    <div className="flex w-[400px] flex-col gap-4">
      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">0%</span>
        <Progress value={0} />
      </div>
      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">25%</span>
        <Progress value={25} />
      </div>
      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">50%</span>
        <Progress value={50} />
      </div>
      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">75%</span>
        <Progress value={75} />
      </div>
      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">100%</span>
        <Progress value={100} />
      </div>
    </div>
  ),
}
