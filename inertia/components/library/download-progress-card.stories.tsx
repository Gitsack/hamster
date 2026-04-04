import type { Meta, StoryObj } from '@storybook/react'
import { DownloadProgressCard } from './download-progress-card'
import type { ActiveDownloadInfo } from '@/hooks/use_active_downloads'

const meta: Meta<typeof DownloadProgressCard> = {
  component: DownloadProgressCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof DownloadProgressCard>

const downloading: ActiveDownloadInfo = {
  progress: 45,
  status: 'downloading',
  title: 'Inception.2010.1080p.BluRay.x264',
  size: 8_589_934_592,
  remaining: 4_724_464_025,
  eta: 3725,
  downloadClient: 'SABnzbd',
}

const almostDone: ActiveDownloadInfo = {
  progress: 92,
  status: 'downloading',
  title: 'Breaking.Bad.S01E01.720p',
  size: 1_073_741_824,
  remaining: 85_899_345,
  eta: 120,
  downloadClient: 'SABnzbd',
}

const importing: ActiveDownloadInfo = {
  progress: 100,
  status: 'importing',
  title: 'Dark.Side.of.the.Moon.FLAC',
  size: 734_003_200,
  remaining: 0,
  eta: null,
  downloadClient: 'SABnzbd',
}

export const SingleDownload: Story = {
  args: {
    downloads: [downloading],
  },
}

export const MultipleDownloads: Story = {
  args: {
    downloads: [downloading, almostDone, importing],
  },
}

export const Importing: Story = {
  args: {
    downloads: [importing],
  },
}

export const Empty: Story = {
  args: {
    downloads: [],
  },
}
