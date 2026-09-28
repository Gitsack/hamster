import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, StatusDot, sortByStatus, toneForStatus } from '@/components/status-badge'

describe('StatusBadge', () => {
  it('names a known outcome with one label', () => {
    render(<StatusBadge status="import_completed" />)
    const badge = screen.getByText('Imported').closest('[data-slot="status-badge"]')
    expect(badge).toHaveAttribute('data-tone', 'ok')
  })

  it('renders an unknown outcome plainly instead of guessing a colour', () => {
    render(<StatusBadge status="warming_up" />)
    const badge = screen.getByText('warming_up').closest('[data-slot="status-badge"]')
    expect(badge).toHaveAttribute('data-tone', 'neutral')
  })

  it('takes an explicit tone and label, and lets children override the label', () => {
    render(
      <StatusBadge tone="transfer" label="Downloading">
        72%
      </StatusBadge>
    )
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.queryByText('Downloading')).not.toBeInTheDocument()
  })

  it('gives the dot an accessible name', () => {
    render(<StatusDot tone="error" label="1 task failed" />)
    expect(screen.getByRole('img', { name: '1 task failed' })).toBeInTheDocument()
  })
})

describe('sortByStatus', () => {
  it('floats errors, then warnings, and keeps everything else in order', () => {
    const rows = [
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'warn' },
      { id: 'c', status: 'failed' },
      { id: 'd', status: 'downloading' },
      { id: 'e', status: 'unreachable' },
    ]
    const sorted = sortByStatus(rows, (row) =>
      row.status === 'warn' ? 'warning' : toneForStatus(row.status)
    )
    expect(sorted.map((row) => row.id)).toEqual(['c', 'e', 'b', 'a', 'd'])
  })
})
