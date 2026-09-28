import type { Meta, StoryObj } from '@storybook/react'
import { useState, type ReactNode } from 'react'
import { ActiveDownloadsProvider } from '@/contexts/active_downloads_context'
import { QueueTab } from './queue-tab'
import { ImportsTab } from './imports-tab'
import { HistoryTab } from './history-tab'
import type { HistoryEventFilter } from './activity_format'

/**
 * The three Activity tabs against a canned API. Each tab fetches on its own, so
 * the stories answer those requests from fixtures instead of a server.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const media = {
  movieId: null,
  movieTitle: null,
  tvShowId: null,
  tvShowTitle: null,
  episodeId: null,
  episodeTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  albumId: null,
  albumTitle: null,
  bookId: null,
  bookTitle: null,
}

const FIXTURES: Array<[RegExp, unknown]> = [
  [
    /\/api\/v1\/queue\/history\?status=failed/,
    {
      data: [
        {
          id: 'f1',
          title: 'Dune.Part.Two.2024.2160p.UHD.BluRay.x265.HDR.DTS-HD.MA.7.1-SWTYBLZ',
          status: 'failed',
          size: 38_400_000_000,
          mediaType: 'movies',
          downloadClient: 'SABnzbd',
          errorMessage:
            'Unpacking failed, archive requires a password. The release is probably fake; blacklist it and search again.',
          startedAt: minutesAgo(190),
          completedAt: minutesAgo(180),
          updatedAt: minutesAgo(180),
          stuck: false,
        },
      ],
      meta: { total: 1 },
    },
  ],
  [
    /\/api\/v1\/queue\/history\?status=importing/,
    {
      data: [
        {
          id: 'i1',
          title: 'The.Bear.S03E04.1080p.WEB.h264-ETHEL',
          status: 'importing',
          size: 1_900_000_000,
          mediaType: 'tv',
          downloadClient: 'SABnzbd',
          errorMessage: null,
          startedAt: minutesAgo(70),
          completedAt: minutesAgo(45),
          updatedAt: minutesAgo(45),
          stuck: true,
        },
        {
          id: 'i2',
          title: 'Khruangbin - A LA SALA (2024) [FLAC 24-96]',
          status: 'importing',
          size: 812_000_000,
          mediaType: 'music',
          downloadClient: 'SABnzbd',
          errorMessage: null,
          startedAt: minutesAgo(6),
          completedAt: minutesAgo(1),
          updatedAt: minutesAgo(1),
          stuck: false,
        },
      ],
      meta: { total: 2 },
    },
  ],
  [
    /\/api\/v1\/queue(\?|$)/,
    [
      {
        id: 'q1',
        externalId: 'SABnzbd_nzo_1',
        title: 'Shogun.2024.S01E07.2160p.DSNP.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX',
        status: 'downloading',
        progress: 63.2,
        size: 9_800_000_000,
        remaining: 3_600_000_000,
        eta: 412,
        albumId: null,
        movieId: null,
        tvShowId: 's1',
        episodeId: 'e7',
        bookId: null,
        downloadClient: 'SABnzbd',
        startedAt: minutesAgo(12),
      },
      {
        id: 'q2',
        externalId: 'SABnzbd_nzo_2',
        title: 'Project.Hail.Mary.Andy.Weir.2021.EPUB',
        status: 'queued',
        progress: 0,
        size: 4_200_000,
        remaining: 4_200_000,
        eta: null,
        albumId: null,
        movieId: null,
        tvShowId: null,
        episodeId: null,
        bookId: 'b1',
        downloadClient: 'SABnzbd',
        startedAt: null,
      },
    ],
  ],
  [
    /\/api\/v1\/activity\/counts/,
    { active: 2, failed: 1, importing: 2, stuckImporting: 1, unmatchedPending: 2 },
  ],
  [
    /\/api\/v1\/files\/browse-completed/,
    {
      importing: [],
      entries: [
        {
          name: 'Oppenheimer.2023.1080p.BluRay.x264-SPARKS',
          path: '/downloads/complete/Oppenheimer.2023.1080p.BluRay.x264-SPARKS',
          baseName: 'oppenheimer 2023',
          isDuplicate: true,
          isUnpacking: false,
          mediaType: 'movies',
          title: 'Oppenheimer',
          year: '2023',
          sizeBytes: 14_100_000_000,
          downloadClientId: '1',
          downloadClientName: 'SABnzbd',
          duplicateCount: 2,
        },
        {
          name: 'Oppenheimer.2023.1080p.BluRay.x264-SPARKS.1',
          path: '/downloads/complete/Oppenheimer.2023.1080p.BluRay.x264-SPARKS.1',
          baseName: 'oppenheimer 2023',
          isDuplicate: false,
          isUnpacking: true,
          mediaType: 'movies',
          title: 'Oppenheimer',
          year: '2023',
          sizeBytes: null,
          downloadClientId: '1',
          downloadClientName: 'SABnzbd',
          duplicateCount: 2,
        },
      ],
    },
  ],
  [
    /\/api\/v1\/unmatched/,
    [
      {
        id: 'u1',
        fileName: 'bonus_disc_featurette_03.mkv',
        mediaType: 'movies',
        fileSizeBytes: 612_000_000,
        parsedInfo: null,
        status: 'pending',
      },
      {
        id: 'u2',
        fileName: 'Some.Show.S01E01.720p.HDTV.mkv',
        mediaType: 'tv',
        fileSizeBytes: 480_000_000,
        parsedInfo: { title: 'Some Show' },
        status: 'pending',
      },
    ],
  ],
  [
    /\/api\/v1\/downloadclients\/[^/]+\/browse/,
    {
      path: '/downloads/complete',
      basePath: '/downloads/complete',
      canGoUp: false,
      parentPath: '/downloads',
      items: [
        {
          name: 'Oppenheimer.2023.1080p.BluRay.x264-SPARKS',
          path: '/downloads/complete/Oppenheimer.2023.1080p.BluRay.x264-SPARKS',
          isDirectory: true,
          size: 14_100_000_000,
          modifiedAt: minutesAgo(300),
        },
        {
          name: 'sample.mkv',
          path: '/downloads/complete/sample.mkv',
          isDirectory: false,
          size: 48_000_000,
          modifiedAt: minutesAgo(3000),
        },
      ],
    },
  ],
  [
    /\/api\/v1\/downloadclients/,
    [
      { id: '1', name: 'SABnzbd', type: 'sabnzbd', enabled: true, localPath: '/downloads' },
      { id: '2', name: 'qBittorrent', type: 'qbittorrent', enabled: true, localPath: '' },
    ],
  ],
  [
    /\/api\/v1\/history\/summary/,
    { days: 7, summary: { grabbed: 42, import_completed: 40, import_failed: 2 } },
  ],
  [
    /\/api\/v1\/history/,
    {
      data: [
        {
          id: 'h1',
          eventType: 'import_failed',
          sourceTitle: 'The.Bear.S03E04.1080p.WEB.h264-ETHEL',
          quality: 'WEBDL-1080p',
          data: { error: 'No video file found in the download folder' },
          createdAt: minutesAgo(45),
          downloadId: 'i1',
          media: {
            ...media,
            tvShowId: 's2',
            tvShowTitle: 'The Bear',
            episodeId: 'e4',
            episodeTitle: 'Violet',
            seasonNumber: 3,
            episodeNumber: 4,
          },
        },
        {
          id: 'h2',
          eventType: 'import_completed',
          sourceTitle: 'Heat.1995.Directors.Definitive.Edition.2160p.UHD.BluRay.REMUX-FGT',
          quality: 'Remux-2160p',
          data: { filesImported: 1 },
          createdAt: minutesAgo(90),
          downloadId: 'd2',
          media: { ...media, movieId: 'm1', movieTitle: 'Heat' },
        },
        {
          id: 'h3',
          eventType: 'grabbed',
          sourceTitle: 'Khruangbin - A LA SALA (2024) [FLAC 24-96]',
          quality: 'FLAC 24bit',
          data: { indexer: 'NZBgeek' },
          createdAt: minutesAgo(130),
          downloadId: 'd3',
          media: { ...media, albumId: 'a1', albumTitle: 'A LA SALA' },
        },
        {
          id: 'h4',
          eventType: 'renamed',
          sourceTitle: null,
          quality: null,
          data: {},
          createdAt: minutesAgo(2000),
          downloadId: null,
          media: { ...media, bookId: 'b1', bookTitle: 'Project Hail Mary' },
        },
      ],
      meta: { total: 128, perPage: 50, currentPage: 1, lastPage: 3 },
    },
  ],
]

function installFetchStub() {
  const w = window as typeof window & { __activityFetchStub?: boolean }
  if (w.__activityFetchStub) return
  w.__activityFetchStub = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const match = FIXTURES.find(([pattern]) => pattern.test(url))
    if (!match) return realFetch(input, init)
    await new Promise((resolve) => setTimeout(resolve, 250))
    return new Response(JSON.stringify(match[1]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function Frame({ children }: { children: ReactNode }) {
  installFetchStub()
  return (
    <ActiveDownloadsProvider>
      <div className="mx-auto w-full max-w-5xl p-4">{children}</div>
    </ActiveDownloadsProvider>
  )
}

const meta: Meta = {
  title: 'activity/Tabs',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

export const Queue: Story = {
  render: () => (
    <Frame>
      <QueueTab reloadSignal={0} processing={false} onProcessDownloads={() => {}} />
    </Frame>
  ),
}
export const QueueDark: Story = { ...Queue, globals: { theme: 'dark' } }
export const QueuePhone: Story = { ...Queue, globals: { viewport: { value: 'phone' } } }
export const QueuePhoneDark: Story = {
  ...Queue,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}

function ImportsStory() {
  const [client, setClient] = useState<string | null>(null)
  return (
    <Frame>
      <ImportsTab
        clientParam={client}
        onClientChange={setClient}
        isAdmin
        reloadSignal={0}
        processing={false}
        onProcessDownloads={() => {}}
      />
    </Frame>
  )
}

export const Imports: Story = { render: () => <ImportsStory /> }
export const ImportsDark: Story = { ...Imports, globals: { theme: 'dark' } }
export const ImportsPhone: Story = { ...Imports, globals: { viewport: { value: 'phone' } } }
export const ImportsPhoneDark: Story = {
  ...Imports,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}

function HistoryStory() {
  const [filter, setFilter] = useState<HistoryEventFilter>('all')
  return (
    <Frame>
      <HistoryTab eventFilter={filter} onEventFilterChange={setFilter} reloadSignal={0} />
    </Frame>
  )
}

export const History: Story = { render: () => <HistoryStory /> }
export const HistoryDark: Story = { ...History, globals: { theme: 'dark' } }
export const HistoryPhone: Story = { ...History, globals: { viewport: { value: 'phone' } } }
export const HistoryPhoneDark: Story = {
  ...History,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}
