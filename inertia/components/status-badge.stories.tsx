import type { Meta, StoryObj } from '@storybook/react'
import { StatusBadge, StatusDot, STATUS_OUTCOMES, type StatusOutcome } from './status-badge'

const meta: Meta<typeof StatusBadge> = {
  component: StatusBadge,
  tags: ['autodocs'],
  args: { status: 'downloading' },
}
export default meta

type Story = StoryObj<typeof StatusBadge>

export const Default: Story = {}

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge tone="ok" label="Reachable" />
      <StatusBadge tone="warning" label="Needs path mapping" />
      <StatusBadge tone="error" label="Unreachable" />
      <StatusBadge tone="paused" label="Paused" />
      <StatusBadge tone="transfer" label="Downloading">
        72%
      </StatusBadge>
      <StatusBadge tone="transit" label="Importing" />
      <StatusBadge tone="queued" label="Queued" />
      <StatusBadge tone="neutral" label="Ignored" />
    </div>
  ),
}

export const EveryOutcome: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {(Object.keys(STATUS_OUTCOMES) as StatusOutcome[]).map((status) => (
        <div key={status} className="flex items-center justify-between gap-4">
          <span className="readout text-xs text-muted-foreground">{status}</span>
          <StatusBadge status={status} />
        </div>
      ))}
    </div>
  ),
}

export const Dots: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-sm">
      <span className="flex items-center gap-2">
        Settings <StatusDot tone="error" label="1 task failed" />
      </span>
      <span className="flex items-center gap-2">
        Indexers <StatusDot tone="warning" label="Prowlarr sync is stale" />
      </span>
      <span className="flex items-center gap-2">
        Media <StatusDot tone="ok" label="Healthy" />
      </span>
    </div>
  ),
}

export const Dark: Story = { ...EveryOutcome, globals: { theme: 'dark' } }

export const Phone: Story = { ...EveryOutcome, globals: { viewport: { value: 'phone' } } }
