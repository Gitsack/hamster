import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { DeleteMediaDialog } from './delete-media-dialog'

const meta: Meta<typeof DeleteMediaDialog> = {
  component: DeleteMediaDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: action('onOpenChange'),
    onConfirm: () => new Promise((r) => setTimeout(r, 1000)),
  },
  argTypes: {
    mode: { control: 'select', options: ['remove', 'deleteFile'] },
    hasFile: { control: 'boolean' },
  },
}
export default meta

type Story = StoryObj<typeof DeleteMediaDialog>

export const RemoveWithFile: Story = {
  args: {
    title: 'Inception',
    mediaType: 'movie',
    hasFile: true,
    mode: 'remove',
  },
}

export const RemoveWithoutFile: Story = {
  args: {
    title: 'The Matrix',
    mediaType: 'movie',
    hasFile: false,
    mode: 'remove',
  },
}

export const DeleteFileMode: Story = {
  args: {
    title: 'Dark Side of the Moon',
    mediaType: 'album',
    hasFile: true,
    mode: 'deleteFile',
  },
}

export const BookRemove: Story = {
  args: {
    title: 'Dune',
    mediaType: 'book',
    hasFile: true,
    mode: 'remove',
  },
}

export const EpisodeDeleteFile: Story = {
  args: {
    title: 'S01E01 - Pilot',
    mediaType: 'episode',
    hasFile: true,
    mode: 'deleteFile',
  },
}
