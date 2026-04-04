import { render, screen } from '@testing-library/react'
import { DownloadProgressCard } from './download-progress-card'
import type { ActiveDownloadInfo } from '@/hooks/use_active_downloads'

// Mock Hugeicons
vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: ({ className }: { className?: string }) => (
    <svg data-testid="icon" className={className} />
  ),
}))

vi.mock('@hugeicons/core-free-icons', () => {
  const m = (name: string) => ({ name })
  return {
    Download01Icon: m('Download01Icon'),
    Time01Icon: m('Time01Icon'),
    HardDriveIcon: m('HardDriveIcon'),
  }
})

function makeDownload(overrides: Partial<ActiveDownloadInfo> = {}): ActiveDownloadInfo {
  return {
    title: 'Test Download',
    progress: 50,
    status: 'downloading',
    size: 1024 * 1024 * 500, // 500 MB
    remaining: 1024 * 1024 * 250, // 250 MB
    eta: 3600,
    downloadClient: 'SABnzbd',
    ...overrides,
  }
}

describe('DownloadProgressCard', () => {
  describe('rendering', () => {
    it('renders nothing when downloads array is empty', () => {
      const { container } = render(<DownloadProgressCard downloads={[]} />)
      expect(container.innerHTML).toBe('')
    })

    it('renders a card when there are downloads', () => {
      render(<DownloadProgressCard downloads={[makeDownload()]} />)
      expect(screen.getByText('Test Download')).toBeInTheDocument()
    })

    it('renders multiple download items', () => {
      const downloads = [
        makeDownload({ title: 'Movie A' }),
        makeDownload({ title: 'Movie B' }),
        makeDownload({ title: 'Movie C' }),
      ]
      render(<DownloadProgressCard downloads={downloads} />)
      expect(screen.getByText('Movie A')).toBeInTheDocument()
      expect(screen.getByText('Movie B')).toBeInTheDocument()
      expect(screen.getByText('Movie C')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(
        <DownloadProgressCard downloads={[makeDownload()]} className="my-custom-class" />
      )
      const card = container.firstElementChild
      expect(card?.className).toContain('my-custom-class')
    })
  })

  describe('progress display', () => {
    it('shows progress percentage for downloading items', () => {
      render(<DownloadProgressCard downloads={[makeDownload({ progress: 75 })]} />)
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('rounds progress percentage', () => {
      render(<DownloadProgressCard downloads={[makeDownload({ progress: 33.7 })]} />)
      expect(screen.getByText('34%')).toBeInTheDocument()
    })

    it('shows "Importing" instead of percentage when status is importing', () => {
      render(<DownloadProgressCard downloads={[makeDownload({ status: 'importing' })]} />)
      expect(screen.getByText('Importing')).toBeInTheDocument()
      expect(screen.queryByText('50%')).not.toBeInTheDocument()
    })
  })

  describe('file size formatting', () => {
    it('displays downloaded and total size', () => {
      render(
        <DownloadProgressCard
          downloads={[
            makeDownload({
              size: 1024 * 1024 * 1024, // 1 GB
              remaining: 1024 * 1024 * 512, // 512 MB
            }),
          ]}
        />
      )
      expect(screen.getByText('512.0 MB / 1.00 GB')).toBeInTheDocument()
    })

    it('formats KB correctly', () => {
      render(
        <DownloadProgressCard
          downloads={[
            makeDownload({
              size: 1024 * 500, // 500 KB
              remaining: 1024 * 200, // 200 KB
            }),
          ]}
        />
      )
      expect(screen.getByText('300.0 KB / 500.0 KB')).toBeInTheDocument()
    })

    it('does not show size when size is null', () => {
      render(
        <DownloadProgressCard
          downloads={[makeDownload({ size: null, remaining: null })]}
        />
      )
      // No size text should appear - check that HardDrive icon section is not rendered
      expect(screen.queryByText(/KB|MB|GB/)).not.toBeInTheDocument()
    })

    it('does not show size when remaining is null', () => {
      render(
        <DownloadProgressCard
          downloads={[makeDownload({ remaining: null })]}
        />
      )
      expect(screen.queryByText(/\//)).not.toBeInTheDocument()
    })
  })

  describe('ETA formatting', () => {
    it('displays hours and minutes for large ETAs', () => {
      render(
        <DownloadProgressCard downloads={[makeDownload({ eta: 7200 + 300 })]} /> // 2h 5m
      )
      expect(screen.getByText('2h 5m remaining')).toBeInTheDocument()
    })

    it('displays minutes and seconds for medium ETAs', () => {
      render(
        <DownloadProgressCard downloads={[makeDownload({ eta: 125 })]} /> // 2m 5s
      )
      expect(screen.getByText('2m 5s remaining')).toBeInTheDocument()
    })

    it('displays only seconds for small ETAs', () => {
      render(
        <DownloadProgressCard downloads={[makeDownload({ eta: 45 })]} />
      )
      expect(screen.getByText('45s remaining')).toBeInTheDocument()
    })

    it('does not show ETA when eta is null', () => {
      render(
        <DownloadProgressCard downloads={[makeDownload({ eta: null })]} />
      )
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })

    it('does not show ETA when eta is 0 or negative', () => {
      render(
        <DownloadProgressCard downloads={[makeDownload({ eta: 0 })]} />
      )
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })

    it('does not show ETA when importing', () => {
      render(
        <DownloadProgressCard
          downloads={[makeDownload({ status: 'importing', eta: 120 })]}
        />
      )
      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
    })
  })

  describe('download client', () => {
    it('displays download client name', () => {
      render(
        <DownloadProgressCard downloads={[makeDownload({ downloadClient: 'SABnzbd' })]} />
      )
      expect(screen.getByText('SABnzbd')).toBeInTheDocument()
    })

    it('does not show download client when null', () => {
      render(
        <DownloadProgressCard downloads={[makeDownload({ downloadClient: null as any })]} />
      )
      expect(screen.queryByText('SABnzbd')).not.toBeInTheDocument()
    })
  })
})
