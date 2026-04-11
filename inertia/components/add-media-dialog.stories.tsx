import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { AddMediaDialog } from './add-media-dialog'
import type { QualityProfile } from './add-media-dialog'

const sampleProfiles: QualityProfile[] = [
  { id: '1', name: 'HD-1080p', mediaType: 'movie' },
  { id: '2', name: 'HD-720p', mediaType: 'movie' },
  { id: '3', name: 'SD', mediaType: 'movie' },
]

const meta: Meta<typeof AddMediaDialog> = {
  component: AddMediaDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: action('onOpenChange'),
    onAdd: action('onAdd'),
    qualityProfiles: sampleProfiles,
  },
  argTypes: {
    mediaType: {
      control: 'select',
      options: ['artist', 'album', 'movie', 'tvshow', 'author', 'book'],
    },
    loading: { control: 'boolean' },
    adding: { control: 'boolean' },
  },
}
export default meta

type Story = StoryObj<typeof AddMediaDialog>

export const Movie: Story = {
  args: {
    mediaType: 'movie',
    title: 'Inception',
    description: 'Add this movie to your library and start monitoring for downloads.',
  },
}

export const Album: Story = {
  args: {
    mediaType: 'album',
    title: 'Dark Side of the Moon',
    description: 'Add this album to your library.',
    qualityProfiles: [
      { id: '1', name: 'Lossless', mediaType: 'album' },
      { id: '2', name: 'High Quality', mediaType: 'album' },
      { id: '3', name: 'Standard', mediaType: 'album' },
    ],
  },
}

export const TvShowWithEpisodes: Story = {
  args: {
    mediaType: 'tvshow',
    title: 'Breaking Bad',
    description: 'Add this TV show to your library.',
    episodeSelectionSummary: '62 of 62 episodes selected (5 seasons)',
    onChangeEpisodeSelection: action('onChangeEpisodeSelection'),
  },
}

export const AuthorWithBooks: Story = {
  args: {
    mediaType: 'author',
    title: 'Frank Herbert',
    description: 'Add this author to your library.',
    showAddBooksOption: true,
  },
}

export const Loading: Story = {
  args: {
    mediaType: 'movie',
    title: 'Inception',
    description: 'Add this movie to your library.',
    loading: true,
  },
}

export const Adding: Story = {
  args: {
    mediaType: 'movie',
    title: 'Inception',
    description: 'Add this movie to your library.',
    adding: true,
  },
}
