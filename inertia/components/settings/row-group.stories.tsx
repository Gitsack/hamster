import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { RowGroup, describeHttpError } from './row-group'
import { ReadoutRow } from './setting-row'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof RowGroup> = {
  component: RowGroup,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof RowGroup>

export const Rows: Story = {
  render: () => (
    <RowGroup>
      <ReadoutRow label="Version" value="v1.37.0" />
      <ReadoutRow label="Uptime" value="3d 4h" />
      <ReadoutRow label="Memory" value="RSS 312 MB" />
    </RowGroup>
  ),
}

export const Loading: Story = {
  args: { loading: true, skeletonRows: 3 },
}

export const FetchFailed: Story = {
  args: {
    error: `Couldn't load tasks: ${describeHttpError({ status: 502, statusText: 'Bad Gateway' })}`,
    onRetry: action('retry'),
  },
}

export const Empty: Story = {
  render: () => (
    <RowGroup
      empty={
        <>
          No indexers yet.{' '}
          <Button variant="link" className="h-auto p-0" onClick={action('add')}>
            Add one
          </Button>
        </>
      }
    >
      {[]}
    </RowGroup>
  ),
}

export const Dark: Story = { ...FetchFailed, globals: { theme: 'dark' } }

export const Phone: Story = { ...FetchFailed, globals: { viewport: { value: 'phone' } } }
