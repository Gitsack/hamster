import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { ConfirmDialog } from './confirm-dialog'

const meta: Meta<typeof ConfirmDialog> = {
  component: ConfirmDialog,
  tags: ['autodocs'],
  args: {
    close: action('close'),
    handleConfirm: action('handleConfirm'),
    loading: false,
  },
}
export default meta

type Story = StoryObj<typeof ConfirmDialog>

export const Default: Story = {
  args: {
    state: {
      open: true,
      title: 'Remove from library?',
      description: 'This action cannot be undone. The item will be removed from your library.',
      confirmLabel: 'Remove',
      loadingLabel: 'Removing...',
    },
  },
}

export const Loading: Story = {
  args: {
    loading: true,
    state: {
      open: true,
      title: 'Delete all files?',
      description: 'This will permanently delete all selected files from disk.',
      confirmLabel: 'Delete All',
      loadingLabel: 'Deleting...',
    },
  },
}

export const RefreshLibrary: Story = {
  args: {
    state: {
      open: true,
      title: 'Refresh library?',
      description: 'This will rescan all media folders and update your library. This may take a while.',
      confirmLabel: 'Refresh',
      loadingLabel: 'Refreshing...',
    },
  },
}
