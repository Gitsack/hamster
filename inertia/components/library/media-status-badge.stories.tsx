import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { MediaStatusBadge, CardStatusBadge } from './media-status-badge'

const meta: Meta<typeof MediaStatusBadge> = {
  component: MediaStatusBadge,
  tags: ['autodocs'],
  args: {
    onToggleRequest: action('onToggleRequest'),
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MediaStatusBadge>

// --- Status variants (default size) ---

export const None: Story = {
  args: {
    status: 'none',
  },
}

export const NoneHidden: Story = {
  name: 'None (showRequestButton=false)',
  args: {
    status: 'none',
    showRequestButton: false,
  },
}

export const Requested: Story = {
  args: {
    status: 'requested',
  },
}

export const Downloading: Story = {
  args: {
    status: 'downloading',
    progress: 42,
  },
}

export const DownloadingAlmostDone: Story = {
  name: 'Downloading (97%)',
  args: {
    status: 'downloading',
    progress: 97.3,
  },
}

export const Importing: Story = {
  args: {
    status: 'importing',
  },
}

export const Downloaded: Story = {
  args: {
    status: 'downloaded',
  },
}

// --- Toggling state ---

export const TogglingFromNone: Story = {
  name: 'Toggling (from none)',
  args: {
    status: 'none',
    isToggling: true,
  },
}

export const TogglingFromRequested: Story = {
  name: 'Toggling (from requested)',
  args: {
    status: 'requested',
    isToggling: true,
  },
}

// --- Size variants ---

export const SmallDownloaded: Story = {
  name: 'Small - Downloaded',
  args: {
    status: 'downloaded',
    size: 'sm',
  },
}

export const SmallRequested: Story = {
  name: 'Small - Requested',
  args: {
    status: 'requested',
    size: 'sm',
  },
}

export const SmallNone: Story = {
  name: 'Small - None',
  args: {
    status: 'none',
    size: 'sm',
  },
}

export const TinyDownloaded: Story = {
  name: 'Tiny - Downloaded',
  args: {
    status: 'downloaded',
    size: 'tiny',
  },
}

export const TinyRequested: Story = {
  name: 'Tiny - Requested',
  args: {
    status: 'requested',
    size: 'tiny',
  },
}

export const TinyNone: Story = {
  name: 'Tiny - None',
  args: {
    status: 'none',
    size: 'tiny',
  },
}

export const TinyDownloading: Story = {
  name: 'Tiny - Downloading',
  args: {
    status: 'downloading',
    progress: 65,
    size: 'tiny',
  },
}

// --- All statuses side by side ---

export const AllStatuses: Story = {
  name: 'All Statuses',
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <MediaStatusBadge {...args} status="none" />
      <MediaStatusBadge {...args} status="requested" />
      <MediaStatusBadge {...args} status="downloading" progress={55} />
      <MediaStatusBadge {...args} status="importing" />
      <MediaStatusBadge {...args} status="downloaded" />
    </div>
  ),
  args: {},
}

// =============================================
// CardStatusBadge stories
// =============================================

const cardMeta: Meta<typeof CardStatusBadge> = {
  component: CardStatusBadge,
  tags: ['autodocs'],
  args: {
    onToggleRequest: action('onToggleRequest'),
  },
}

export const CardNone: StoryObj<typeof CardStatusBadge> = {
  name: 'Card - None',
  render: (args) => (
    <div className="group" style={{ padding: '2rem' }}>
      <CardStatusBadge {...args} />
    </div>
  ),
  args: {
    status: 'none',
    size: 'sm',
    showOnHover: false,
    onToggleRequest: action('onToggleRequest'),
  },
}

export const CardNoneShowOnHover: StoryObj<typeof CardStatusBadge> = {
  name: 'Card - None (hover to show)',
  render: (args) => (
    <div
      className="group"
      style={{ padding: '2rem', border: '1px dashed gray', borderRadius: '8px' }}
    >
      <p style={{ fontSize: '12px', marginBottom: '8px', color: 'gray' }}>
        Hover this area to reveal the button
      </p>
      <CardStatusBadge {...args} />
    </div>
  ),
  args: {
    status: 'none',
    size: 'sm',
    showOnHover: true,
    onToggleRequest: action('onToggleRequest'),
  },
}

export const CardRequested: StoryObj<typeof CardStatusBadge> = {
  name: 'Card - Requested',
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <CardStatusBadge {...args} />
    </div>
  ),
  args: {
    status: 'requested',
    size: 'sm',
    onToggleRequest: action('onToggleRequest'),
  },
}

export const CardDownloaded: StoryObj<typeof CardStatusBadge> = {
  name: 'Card - Downloaded',
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <CardStatusBadge {...args} />
    </div>
  ),
  args: {
    status: 'downloaded',
    size: 'sm',
    onToggleRequest: action('onToggleRequest'),
  },
}

export const CardToggling: StoryObj<typeof CardStatusBadge> = {
  name: 'Card - Toggling',
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <CardStatusBadge {...args} />
    </div>
  ),
  args: {
    status: 'none',
    size: 'sm',
    isToggling: true,
    onToggleRequest: action('onToggleRequest'),
  },
}

export const CardTiny: StoryObj<typeof CardStatusBadge> = {
  name: 'Card - Tiny None',
  render: (args) => (
    <div className="group" style={{ padding: '2rem' }}>
      <CardStatusBadge {...args} />
    </div>
  ),
  args: {
    status: 'none',
    size: 'tiny',
    onToggleRequest: action('onToggleRequest'),
  },
}
