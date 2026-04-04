import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteMediaDialog } from './delete-media-dialog'

describe('DeleteMediaDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Test Item',
    mediaType: 'movie',
    hasFile: false,
    mode: 'remove' as const,
    onConfirm: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('remove mode without files', () => {
    it('shows delete title with item name', () => {
      render(<DeleteMediaDialog {...defaultProps} />)
      expect(screen.getByText('Delete Test Item?')).toBeInTheDocument()
    })

    it('shows Remove button', () => {
      render(<DeleteMediaDialog {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    })

    it('does not show checkbox when no files', () => {
      render(<DeleteMediaDialog {...defaultProps} />)
      expect(screen.queryByText('Also delete files from disk')).not.toBeInTheDocument()
    })

    it('calls onConfirm with false when confirmed', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      render(<DeleteMediaDialog {...defaultProps} onConfirm={onConfirm} />)

      await user.click(screen.getByRole('button', { name: 'Remove' }))
      expect(onConfirm).toHaveBeenCalledWith(false)
    })
  })

  describe('remove mode with files', () => {
    it('shows remove from library title', () => {
      render(<DeleteMediaDialog {...defaultProps} hasFile={true} />)
      expect(screen.getByText('Remove movie from library?')).toBeInTheDocument()
    })

    it('shows delete files checkbox', () => {
      render(<DeleteMediaDialog {...defaultProps} hasFile={true} />)
      expect(screen.getByText('Also delete files from disk')).toBeInTheDocument()
    })

    it('checkbox is checked by default when files exist', () => {
      render(<DeleteMediaDialog {...defaultProps} hasFile={true} />)
      expect(screen.getByRole('button', { name: 'Delete Files & Remove' })).toBeInTheDocument()
    })

    it('calls onConfirm with true when checkbox is checked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      render(<DeleteMediaDialog {...defaultProps} hasFile={true} onConfirm={onConfirm} />)

      await user.click(screen.getByRole('button', { name: 'Delete Files & Remove' }))
      expect(onConfirm).toHaveBeenCalledWith(true)
    })

    it('calls onConfirm with false when checkbox is unchecked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      render(<DeleteMediaDialog {...defaultProps} hasFile={true} onConfirm={onConfirm} />)

      // Uncheck the checkbox
      await user.click(screen.getByText('Also delete files from disk'))
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Remove' }))
      expect(onConfirm).toHaveBeenCalledWith(false)
    })
  })

  describe('deleteFile mode', () => {
    it('shows delete file title', () => {
      render(<DeleteMediaDialog {...defaultProps} mode="deleteFile" hasFile={true} />)
      expect(screen.getByText('Delete movie file?')).toBeInTheDocument()
    })

    it('shows item name in description', () => {
      render(<DeleteMediaDialog {...defaultProps} mode="deleteFile" hasFile={true} />)
      expect(screen.getByText(/Test Item/)).toBeInTheDocument()
    })

    it('shows Delete File button', () => {
      render(<DeleteMediaDialog {...defaultProps} mode="deleteFile" hasFile={true} />)
      expect(screen.getByRole('button', { name: 'Delete File' })).toBeInTheDocument()
    })

    it('calls onConfirm with true', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      render(
        <DeleteMediaDialog {...defaultProps} mode="deleteFile" hasFile={true} onConfirm={onConfirm} />
      )

      await user.click(screen.getByRole('button', { name: 'Delete File' }))
      expect(onConfirm).toHaveBeenCalledWith(true)
    })
  })

  describe('loading state', () => {
    it('shows loading state during confirm', async () => {
      const user = userEvent.setup()
      let resolveConfirm: () => void
      const onConfirm = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => {
          resolveConfirm = resolve
        })
      )
      render(<DeleteMediaDialog {...defaultProps} onConfirm={onConfirm} />)

      await user.click(screen.getByRole('button', { name: 'Remove' }))
      expect(screen.getByText('Deleting...')).toBeInTheDocument()

      resolveConfirm!()
    })
  })

  describe('cancel', () => {
    it('calls onOpenChange when cancel is clicked', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      render(<DeleteMediaDialog {...defaultProps} onOpenChange={onOpenChange} />)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('does not render when closed', () => {
    render(<DeleteMediaDialog {...defaultProps} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
