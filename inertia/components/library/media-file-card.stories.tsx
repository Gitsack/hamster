import type { Meta, StoryObj } from '@storybook/react'
import { action } from 'storybook/actions'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert01Icon,
  Delete01Icon,
  FileDownloadIcon,
  PlayIcon,
  Refresh01Icon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { MediaFileCard } from './media-file-card'

const meta: Meta<typeof MediaFileCard> = {
  component: MediaFileCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '52rem' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MediaFileCard>

const movieActions = (
  <>
    <Button variant="default" size="sm" onClick={action('play')} aria-label="Play">
      <HugeiconsIcon icon={PlayIcon} className="h-4 w-4" />
      <span className="hidden sm:inline">Play</span>
    </Button>
    <Button variant="outline" size="sm" onClick={action('download')} aria-label="Download">
      <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
      <span className="hidden sm:inline">Download</span>
    </Button>
    <Button variant="outline" size="sm" onClick={action('replace')} aria-label="Replace">
      <HugeiconsIcon icon={Refresh01Icon} className="h-4 w-4" />
      <span className="hidden sm:inline">Replace</span>
    </Button>
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={action('delete')}
      aria-label="Delete"
    >
      <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
      <span className="hidden sm:inline">Delete</span>
    </Button>
  </>
)

export const Movie: Story = {
  args: {
    path: '/media/movies/Blade Runner 2049 (2017)/Blade Runner 2049 (2017) Bluray-1080p Proper.mkv',
    specs: [
      { label: 'Quality', value: 'Bluray-1080p' },
      { label: 'Size', value: '8.42 GB', mono: true },
      { label: 'Video', value: '1080p h264', mono: true },
      { label: 'Audio', value: 'EAC3 5.1', mono: true },
    ],
    actions: movieActions,
  },
}

/** The long-name case: a scene release name that has to truncate rather than push the card wide. */
export const LongFilename: Story = {
  args: {
    ...Movie.args,
    path: '/media/movies/Blade Runner 2049 (2017)/Blade.Runner.2049.2017.PROPER.REPACK.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.7.1.Atmos-GROUPNAME.mkv',
  },
}

export const Book: Story = {
  args: {
    path: '/media/books/Ursula K. Le Guin/The Dispossessed.epub',
    specs: [
      { label: 'Format', value: 'EPUB' },
      { label: 'Size', value: '1.10 MB', mono: true },
    ],
    actions: (
      <>
        <Button variant="outline" size="sm" onClick={action('download')} aria-label="Download">
          <HugeiconsIcon icon={FileDownloadIcon} className="h-4 w-4" />
          <span className="hidden sm:inline">Download</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={action('delete')}
          aria-label="Delete"
        >
          <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
          <span className="hidden sm:inline">Delete</span>
        </Button>
      </>
    ),
  },
}

export const BelowQualityProfile: Story = {
  args: {
    ...Movie.args,
    specs: [
      { label: 'Quality', value: 'WEBDL-720p' },
      { label: 'Size', value: '1.20 GB', mono: true },
      { label: 'Video', value: '720p h264', mono: true },
      { label: 'Audio', value: 'AAC 2.0', mono: true },
    ],
    children: (
      <div className="border-border space-y-2 border-t pt-3">
        <p className="text-status-failed-ink flex items-center gap-2 text-sm font-medium">
          <HugeiconsIcon icon={Alert01Icon} className="h-4 w-4 shrink-0" />
          Below your quality profile
        </p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>Quality is below the profile's cutoff.</li>
          <li>Audio is stereo AAC; the profile asks for 5.1 or better.</li>
        </ul>
        <Button size="sm" variant="outline" onClick={action('find better release')}>
          <HugeiconsIcon icon={Refresh01Icon} className="h-4 w-4" />
          Find a better release
        </Button>
      </div>
    ),
  },
}
