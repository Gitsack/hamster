import type { Meta, StoryObj } from '@storybook/react'
import { MediaImage } from './media-image'

const meta: Meta<typeof MediaImage> = {
  component: MediaImage,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '200px', height: '300px', borderRadius: '8px', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MediaImage>

// --- With valid image ---

export const MovieWithImage: Story = {
  args: {
    src: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    alt: 'Fight Club',
    mediaType: 'movies',
  },
}

export const TvWithImage: Story = {
  name: 'TV Show With Image',
  args: {
    src: 'https://image.tmdb.org/t/p/w300/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    alt: 'Breaking Bad',
    mediaType: 'tv',
  },
}

export const AlbumWithImage: Story = {
  args: {
    src: 'https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15c37c/829521842-250.jpg',
    alt: 'Album Art',
    mediaType: 'album',
  },
}

// --- Fallback (no src) ---

export const MovieFallback: Story = {
  name: 'Movie Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Movie',
    mediaType: 'movies',
  },
}

export const TvFallback: Story = {
  name: 'TV Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown TV Show',
    mediaType: 'tv',
  },
}

export const MusicFallback: Story = {
  name: 'Music Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Artist',
    mediaType: 'music',
  },
}

export const BooksFallback: Story = {
  name: 'Books Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Book',
    mediaType: 'books',
  },
}

export const AlbumFallback: Story = {
  name: 'Album Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Album',
    mediaType: 'album',
  },
}

// --- Error state (broken URL triggers fallback) ---

export const BrokenImage: Story = {
  name: 'Broken Image (error fallback)',
  args: {
    src: 'https://example.com/this-image-does-not-exist.jpg',
    alt: 'Broken Image Test',
    mediaType: 'movies',
  },
}

// --- Custom icon size ---

export const CustomIconSize: Story = {
  name: 'Custom Icon Size',
  args: {
    src: null,
    alt: 'Large Icon',
    mediaType: 'music',
    iconClassName: 'h-24 w-24',
  },
}

export const SmallIconSize: Story = {
  name: 'Small Icon Size',
  decorators: [
    (Story) => (
      <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', background: 'var(--muted, #f3f4f6)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    src: null,
    alt: 'Small Icon',
    mediaType: 'tv',
    iconClassName: 'h-8 w-8',
  },
}

// --- All media type fallbacks side by side ---

export const AllFallbacks: Story = {
  name: 'All Media Type Fallbacks',
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      {(['music', 'movies', 'tv', 'books', 'album'] as const).map((type) => (
        <div
          key={type}
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
          }}
        >
          <MediaImage src={null} alt={type} mediaType={type} iconClassName="h-10 w-10" />
          <p style={{ textAlign: 'center', fontSize: '11px', marginTop: '4px' }}>{type}</p>
        </div>
      ))}
    </>
  ),
}
