import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getMediaItemStatus, MediaStatusBadge } from './media-status-badge'

describe('getMediaItemStatus', () => {
  describe('downloaded status', () => {
    it('returns downloaded when item has file', () => {
      const result = getMediaItemStatus({ hasFile: true })
      expect(result).toEqual({ status: 'downloaded', progress: 100 })
    })

    it('returns downloaded even when also requested', () => {
      const result = getMediaItemStatus({ hasFile: true, requested: true })
      expect(result).toEqual({ status: 'downloaded', progress: 100 })
    })

    it('returns downloaded even with active download', () => {
      const result = getMediaItemStatus({ hasFile: true }, { progress: 50, status: 'downloading' })
      expect(result).toEqual({ status: 'downloaded', progress: 100 })
    })
  })

  describe('downloading status', () => {
    it('returns downloading with progress when active download exists', () => {
      const result = getMediaItemStatus({ hasFile: false }, { progress: 45, status: 'downloading' })
      expect(result).toEqual({ status: 'downloading', progress: 45 })
    })

    it('returns downloading with zero progress', () => {
      const result = getMediaItemStatus({}, { progress: 0, status: 'downloading' })
      expect(result).toEqual({ status: 'downloading', progress: 0 })
    })

    it('returns downloading with 100% progress', () => {
      const result = getMediaItemStatus({}, { progress: 100, status: 'downloading' })
      expect(result).toEqual({ status: 'downloading', progress: 100 })
    })
  })

  describe('importing status', () => {
    it('returns importing when active download has importing status', () => {
      const result = getMediaItemStatus({ hasFile: false }, { progress: 100, status: 'importing' })
      expect(result).toEqual({ status: 'importing', progress: 100 })
    })

    it('returns importing regardless of download progress value', () => {
      const result = getMediaItemStatus({}, { progress: 50, status: 'importing' })
      expect(result).toEqual({ status: 'importing', progress: 100 })
    })
  })

  describe('requested status', () => {
    it('returns requested when item is requested but no file or download', () => {
      const result = getMediaItemStatus({ requested: true })
      expect(result).toEqual({ status: 'requested', progress: 0 })
    })

    it('returns requested when hasFile is false and requested is true', () => {
      const result = getMediaItemStatus({ hasFile: false, requested: true })
      expect(result).toEqual({ status: 'requested', progress: 0 })
    })

    it('returns requested with null active download', () => {
      const result = getMediaItemStatus({ requested: true }, null)
      expect(result).toEqual({ status: 'requested', progress: 0 })
    })
  })

  describe('none status', () => {
    it('returns none when no properties are set', () => {
      const result = getMediaItemStatus({})
      expect(result).toEqual({ status: 'none', progress: 0 })
    })

    it('returns none when all properties are false/undefined', () => {
      const result = getMediaItemStatus({ hasFile: false, requested: false })
      expect(result).toEqual({ status: 'none', progress: 0 })
    })

    it('returns none with no active download', () => {
      const result = getMediaItemStatus({}, null)
      expect(result).toEqual({ status: 'none', progress: 0 })
    })

    it('returns none with undefined active download', () => {
      const result = getMediaItemStatus({}, undefined)
      expect(result).toEqual({ status: 'none', progress: 0 })
    })
  })

  describe('priority ordering', () => {
    it('hasFile takes priority over activeDownload', () => {
      const result = getMediaItemStatus(
        { hasFile: true, requested: true },
        { progress: 50, status: 'downloading' }
      )
      expect(result.status).toBe('downloaded')
    })

    it('activeDownload takes priority over requested', () => {
      const result = getMediaItemStatus(
        { hasFile: false, requested: true },
        { progress: 30, status: 'downloading' }
      )
      expect(result.status).toBe('downloading')
    })

    it('importing download takes priority over requested', () => {
      const result = getMediaItemStatus({ requested: true }, { progress: 100, status: 'importing' })
      expect(result.status).toBe('importing')
    })
  })
})

describe('MediaStatusBadge — the reversal contract', () => {
  const coarse = (matches: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    )

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fires immediately on a fine pointer', async () => {
    coarse(false)
    const onToggleRequest = vi.fn()
    render(<MediaStatusBadge status="requested" onToggleRequest={onToggleRequest} />)

    await userEvent.click(screen.getByRole('button'))
    expect(onToggleRequest).toHaveBeenCalledTimes(1)
  })

  it('arms on the first tap and commits on the second when there is no hover', async () => {
    coarse(true)
    const onToggleRequest = vi.fn()
    render(<MediaStatusBadge status="downloaded" onToggleRequest={onToggleRequest} />)

    const badge = screen.getByRole('button')
    await userEvent.click(badge)
    expect(onToggleRequest).not.toHaveBeenCalled()
    expect(badge).toHaveAttribute('data-armed', 'true')
    expect(badge).toHaveAccessibleName(/^Confirm — /)

    await userEvent.click(badge)
    expect(onToggleRequest).toHaveBeenCalledTimes(1)
    expect(badge).toHaveAttribute('data-armed', 'false')
  })

  it('renders a plain statement of state when there is nothing to reverse', () => {
    coarse(false)
    render(<MediaStatusBadge status="downloaded" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Downloaded')).toBeInTheDocument()
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })
})
