import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { CredentialRow, FieldRow, ReadoutRow, ToggleRow } from '@/components/settings/setting-row'

function ControlledToggle({ onSave }: { onSave: (next: boolean) => unknown }) {
  const [checked, setChecked] = useState(false)
  return (
    <ToggleRow
      label="Hardware acceleration"
      description="Use the GPU for transcoding."
      checked={checked}
      onSave={async (next) => {
        await onSave(next)
        setChecked(next)
      }}
    />
  )
}

describe('ToggleRow', () => {
  it('saves, keeps the new value and shows a Saved tick', async () => {
    const onSave = vi.fn()
    render(<ControlledToggle onSave={onSave} />)

    const toggle = screen.getByRole('switch', { name: 'Hardware acceleration' })
    await userEvent.click(toggle)

    expect(onSave).toHaveBeenCalledWith(true)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(toggle).toBeChecked()
  })

  it('reverts and explains when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('HTTP 500 · Internal Server Error'))
    render(<ControlledToggle onSave={onSave} />)

    const toggle = screen.getByRole('switch', { name: 'Hardware acceleration' })
    await userEvent.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500')
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})

describe('FieldRow', () => {
  it('reports typed values and never saves by itself', async () => {
    const onChange = vi.fn()
    render(<FieldRow label="Minimum size" value="" onChange={onChange} suffix="GB" />)

    await userEvent.type(screen.getByLabelText('Minimum size'), '2')
    expect(onChange).toHaveBeenCalledWith('2')
    expect(screen.getByText('GB')).toBeInTheDocument()
  })

  it('marks the input invalid with its message', () => {
    render(<FieldRow label="Port" value="99999" onChange={() => {}} error="Use 1–65535." />)
    const input = screen.getByLabelText('Port')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/Use 1–65535/)
  })
})

describe('CredentialRow', () => {
  it('shows Missing and never renders a stored value', () => {
    render(<CredentialRow label="TMDB API key" isSet={false} onSave={() => {}} />)
    expect(screen.getByText('Missing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add TMDB API key' })).toBeInTheDocument()
  })

  it('refuses an empty value, then saves a trimmed one', async () => {
    const onSave = vi.fn()
    render(<CredentialRow label="TMDB API key" isSet onSave={onSave} />)

    expect(screen.getByText('Set')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Replace TMDB API key' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Replace TMDB API key')
    const input = screen.getByLabelText('TMDB API key')
    expect(input).toHaveValue('')

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('TMDB API key is empty.')
    expect(onSave).not.toHaveBeenCalled()

    await userEvent.type(input, '  abc123  ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith('abc123')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('keeps the dialog open with the reason when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Key rejected by TMDB'))
    render(<CredentialRow label="TMDB API key" isSet={false} onSave={onSave} />)

    await userEvent.click(screen.getByRole('button', { name: 'Add TMDB API key' }))
    await userEvent.type(screen.getByLabelText('TMDB API key'), 'bad')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Key rejected by TMDB')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('ReadoutRow', () => {
  it('shows the value beside its label', () => {
    render(<ReadoutRow label="Version" value="v1.37.0" />)
    expect(screen.getByText('Version')).toBeInTheDocument()
    expect(screen.getByText('v1.37.0')).toBeInTheDocument()
  })
})
