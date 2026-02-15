import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { MediaTeaser, StreamingProviderLoader } from './media-teaser'

const meta: Meta<typeof MediaTeaser> = {
  component: MediaTeaser,
  tags: ['autodocs'],
  args: {
    onToggleRequest: action('onToggleRequest'),
    onClick: action('onClick'),
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', maxWidth: '220px' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MediaTeaser>

// --- Basic variants ---

export const Default: Story = {
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama', 'Thriller'],
    mediaType: 'movie',
    status: 'none',
  },
}

export const TvShow: Story = {
  args: {
    tmdbId: '1396',
    title: 'Breaking Bad',
    year: 2008,
    posterUrl: 'https://image.tmdb.org/t/p/w300/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    genres: ['Drama', 'Crime'],
    mediaType: 'tv',
    status: 'downloaded',
  },
}

export const NoPoster: Story = {
  name: 'No Poster (movie)',
  args: {
    tmdbId: '999',
    title: 'Unknown Movie With a Longer Title',
    year: 2024,
    posterUrl: null,
    genres: ['Sci-Fi'],
    mediaType: 'movie',
    status: 'none',
  },
}

export const NoPosterTv: Story = {
  name: 'No Poster (TV)',
  args: {
    tmdbId: '888',
    title: 'Mystery TV Show',
    year: 2023,
    posterUrl: null,
    genres: [],
    mediaType: 'tv',
    status: 'requested',
  },
}

// --- Status variants ---

export const StatusNone: Story = {
  name: 'Status: None',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'none',
    showStatusOnHover: true,
  },
}

export const StatusRequested: Story = {
  name: 'Status: Requested',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'requested',
  },
}

export const StatusDownloading: Story = {
  name: 'Status: Downloading',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'downloading',
  },
}

export const StatusImporting: Story = {
  name: 'Status: Importing',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'importing',
  },
}

export const StatusDownloaded: Story = {
  name: 'Status: Downloaded',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'downloaded',
  },
}

export const Toggling: Story = {
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'none',
    isToggling: true,
  },
}

// --- Size variants ---

export const SizeGrid: Story = {
  name: 'Size: Grid (default)',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', width: '200px' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'downloaded',
    size: 'grid',
  },
}

export const SizeLane: Story = {
  name: 'Size: Lane',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'downloaded',
    size: 'lane',
  },
}

export const SizeSmall: Story = {
  name: 'Size: Small',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'none',
    size: 'small',
  },
}

// --- Streaming providers ---

export const WithStreamingProviders: Story = {
  name: 'With Streaming Providers',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'downloaded',
    streamingProviders: [
      { id: 8, name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
      { id: 337, name: 'Disney+', logoUrl: 'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
    ],
  },
}

export const ManyStreamingProviders: Story = {
  name: 'Many Streaming Providers (overflow)',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'none',
    streamingProviders: [
      { id: 8, name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
      { id: 337, name: 'Disney+', logoUrl: 'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
      { id: 9, name: 'Prime Video', logoUrl: 'https://image.tmdb.org/t/p/original/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
      { id: 350, name: 'Apple TV+', logoUrl: 'https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg' },
      { id: 531, name: 'Paramount+', logoUrl: 'https://image.tmdb.org/t/p/original/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
    ],
  },
}

// --- No genres, no year ---

export const MinimalInfo: Story = {
  name: 'Minimal Info (no year, no genres)',
  args: {
    tmdbId: '12345',
    title: 'Untitled Project',
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    mediaType: 'movie',
    status: 'none',
  },
}

// --- Row of teasers ---

export const LaneRow: Story = {
  name: 'Lane Row (multiple)',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', display: 'flex', gap: '1rem', maxWidth: '800px' }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <>
      <MediaTeaser
        {...args}
        tmdbId="550"
        title="Fight Club"
        year={1999}
        posterUrl="https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg"
        status="downloaded"
        size="lane"
      />
      <MediaTeaser
        {...args}
        tmdbId="680"
        title="Pulp Fiction"
        year={1994}
        posterUrl="https://image.tmdb.org/t/p/w300/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg"
        status="requested"
        size="lane"
      />
      <MediaTeaser
        {...args}
        tmdbId="999"
        title="No Poster Film"
        year={2025}
        posterUrl={null}
        status="none"
        size="lane"
        mediaType="movie"
      />
      <MediaTeaser
        {...args}
        tmdbId="1396"
        title="Breaking Bad"
        year={2008}
        posterUrl="https://image.tmdb.org/t/p/w300/ggFHVNu6YYI5L9pCfOacjizRGt.jpg"
        status="downloading"
        mediaType="tv"
        size="lane"
      />
    </>
  ),
  args: {
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'none',
  },
}

// --- Loading providers ---

export const LoadingProviders: Story = {
  name: 'Loading Providers (matrix)',
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'none',
    isLoadingProviders: true,
  },
}

export const LoadingProvidersTv: Story = {
  name: 'Loading Providers (TV, no poster)',
  args: {
    tmdbId: '888',
    title: 'Mystery Show',
    year: 2024,
    posterUrl: null,
    genres: ['Sci-Fi'],
    mediaType: 'tv',
    status: 'requested',
    isLoadingProviders: true,
  },
}

export const LoadingProvidersSmall: Story = {
  name: 'Loading Providers (small size)',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    tmdbId: '550',
    title: 'Fight Club',
    year: 1999,
    posterUrl: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    genres: ['Drama'],
    mediaType: 'movie',
    status: 'downloaded',
    isLoadingProviders: true,
    size: 'small',
  },
}

// --- Standalone loader badge ---

export const StreamingLoaderBadge: StoryObj = {
  name: 'Streaming Loader Badge (standalone)',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <StreamingProviderLoader />
      <span style={{ color: '#888', fontSize: 12 }}>← Matrix loading badge at actual size (20×20)</span>
    </>
  ),
}

export const StreamingLoaderOnDarkBg: StoryObj = {
  name: 'Streaming Loader Badge (on poster)',
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div
      style={{
        position: 'relative',
        width: 200,
        height: 300,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#1a1a1a',
      }}
    >
      <img
        src="https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg"
        alt="poster"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
        <StreamingProviderLoader />
      </div>
    </div>
  ),
}
