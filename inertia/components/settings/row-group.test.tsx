import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RowGroup, describeHttpError } from '@/components/settings/row-group'
import { ReadoutRow } from '@/components/settings/setting-row'

describe('RowGroup', () => {
  it('paints skeletons, not rows, while loading', () => {
    const { container } = render(
      <RowGroup loading skeletonRows={2}>
        <ReadoutRow label="Version" value="v1" />
      </RowGroup>
    )
    expect(screen.queryByText('Version')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('shows a fetch failure inline with a retry', async () => {
    const onRetry = vi.fn()
    render(
      <RowGroup
        error={describeHttpError({ status: 502, statusText: 'Bad Gateway' })}
        onRetry={onRetry}
      >
        <ReadoutRow label="Version" value="v1" />
      </RowGroup>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 502 · Bad Gateway')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('collapses to one muted line when empty', () => {
    render(<RowGroup empty="No indexers yet.">{[]}</RowGroup>)
    expect(screen.getByText('No indexers yet.')).toBeInTheDocument()
  })
})
