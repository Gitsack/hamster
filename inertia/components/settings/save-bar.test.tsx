import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaveBar, useFormDraft } from '@/components/settings/save-bar'
import { FieldRow } from '@/components/settings/setting-row'

function NamingForm({ persist }: { persist: (draft: { folder: string }) => unknown }) {
  const form = useFormDraft({ folder: '{Artist Name}' })
  return (
    <div>
      <FieldRow
        label="Artist folder format"
        value={form.draft.folder}
        onChange={(value) => form.set('folder', value)}
        mono
      />
      <SaveBar
        dirty={form.dirty}
        saving={form.saving}
        error={form.error}
        onDiscard={form.discard}
        onSave={() => void form.save(persist)}
      />
    </div>
  )
}

describe('SaveBar with useFormDraft', () => {
  it('stays hidden until a field changes', async () => {
    render(<NamingForm persist={vi.fn()} />)
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Artist folder format'), '!')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('discards back to what was saved', async () => {
    render(<NamingForm persist={vi.fn()} />)
    const input = screen.getByLabelText('Artist folder format')
    await userEvent.type(input, '!')

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(input).toHaveValue('{Artist Name}')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('saves the draft and hides', async () => {
    const persist = vi.fn()
    render(<NamingForm persist={persist} />)
    await userEvent.type(screen.getByLabelText('Artist folder format'), '!')

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(persist).toHaveBeenCalledWith({ folder: '{Artist Name}!' })
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument())
  })

  it('keeps the bar with the reason when saving fails', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('Folder format needs {Artist Name}'))
    render(<NamingForm persist={persist} />)
    await userEvent.type(screen.getByLabelText('Artist folder format'), '!')

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Folder format needs')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('saves on Ctrl+S while dirty', async () => {
    const persist = vi.fn()
    render(<NamingForm persist={persist} />)
    await userEvent.type(screen.getByLabelText('Artist folder format'), '!')

    await userEvent.keyboard('{Control>}s{/Control}')
    expect(persist).toHaveBeenCalledTimes(1)
  })
})
