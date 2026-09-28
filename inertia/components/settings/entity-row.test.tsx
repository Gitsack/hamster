import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntityRow } from '@/components/settings/entity-row'
import { StatusBadge } from '@/components/status-badge'

describe('EntityRow', () => {
  it('opens from the name and joins the meta line', async () => {
    const onOpen = vi.fn()
    render(
      <EntityRow
        name="SABnzbd"
        status={<StatusBadge status="reachable" />}
        meta={['sab:8080', null, 'category hamster']}
        onOpen={onOpen}
      />
    )

    expect(screen.getByText('sab:8080')).toBeInTheDocument()
    expect(screen.getByText('category hamster')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'SABnzbd' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('switches without opening the row', async () => {
    const onOpen = vi.fn()
    const onEnabledChange = vi.fn()
    render(<EntityRow name="NZBgeek" enabled onEnabledChange={onEnabledChange} onOpen={onOpen} />)

    await userEvent.click(screen.getByRole('switch', { name: 'Enabled' }))
    expect(onEnabledChange).toHaveBeenCalledWith(false)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('can show the switch but refuse changes', async () => {
    const onEnabledChange = vi.fn()
    render(
      <EntityRow name="Movies" enabled={false} onEnabledChange={onEnabledChange} enabledDisabled />
    )

    const toggle = screen.getByRole('switch', { name: 'Enabled' })
    expect(toggle).toHaveAttribute('data-disabled')
    await userEvent.setup({ pointerEventsCheck: 0 }).click(toggle)
    expect(onEnabledChange).not.toHaveBeenCalled()
  })

  it('reverts the switch and shows the failure', async () => {
    const onEnabledChange = vi.fn().mockRejectedValue(new Error('HTTP 409 · Conflict'))
    render(<EntityRow name="NZBgeek" enabled onEnabledChange={onEnabledChange} />)

    const toggle = screen.getByRole('switch', { name: 'Enabled' })
    await userEvent.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 409')
    await waitFor(() => expect(toggle).toBeChecked())
  })

  it('asks before a destructive action and only runs it on confirm', async () => {
    const onDelete = vi.fn()
    render(
      <EntityRow
        name="NZBgeek"
        actions={[
          { label: 'Test', onSelect: vi.fn() },
          {
            label: 'Delete',
            destructive: true,
            onSelect: onDelete,
            confirm: { title: 'Delete NZBgeek?', confirmLabel: 'Delete indexer' },
          },
        ]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(await screen.findByRole('alertdialog')).toHaveAccessibleName('Delete NZBgeek?')
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete indexer' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
