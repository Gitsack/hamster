import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AudioLanguageRules,
  type AudioLanguageValue,
} from '@/components/settings/audio-language-rules'
import {
  DEFAULT_REQUIREMENTS,
  QualityRequirementsFields,
} from '@/components/settings/quality-requirements-fields'

const empty: AudioLanguageValue = {
  requiredAudioLanguages: [],
  requireAllAudioLanguages: false,
  preferredAudioLanguages: [],
  blockedAudioLanguages: [],
}

describe('AudioLanguageRules', () => {
  it('adds a searched language as required', async () => {
    const onChange = vi.fn()
    render(<AudioLanguageRules value={empty} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Search languages'), 'germ')
    await userEvent.click(screen.getByRole('button', { name: /German/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ requiredAudioLanguages: ['de'] })
    )
  })

  it('gives a language one role at a time', async () => {
    const onChange = vi.fn()
    render(
      <AudioLanguageRules
        value={{ ...empty, requiredAudioLanguages: ['de'] }}
        onChange={onChange}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Blocked' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ requiredAudioLanguages: [], blockedAudioLanguages: ['de'] })
    )
  })

  it('offers the all-of switch only once two languages are required', async () => {
    const { rerender } = render(
      <AudioLanguageRules value={{ ...empty, requiredAudioLanguages: ['de'] }} onChange={vi.fn()} />
    )
    expect(screen.queryByText(/Require every one of them/)).toBeNull()

    rerender(
      <AudioLanguageRules
        value={{ ...empty, requiredAudioLanguages: ['de', 'en'] }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Require every one of them/)).toBeTruthy()
  })

  it('drops the all-of rule when the second language goes away', async () => {
    const onChange = vi.fn()
    render(
      <AudioLanguageRules
        value={{
          ...empty,
          requiredAudioLanguages: ['de', 'en'],
          requireAllAudioLanguages: true,
        }}
        onChange={onChange}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Remove English' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredAudioLanguages: ['de'],
        requireAllAudioLanguages: false,
      })
    )
  })

  it('states the rule it is enforcing in a sentence', () => {
    render(
      <AudioLanguageRules
        value={{ ...empty, requiredAudioLanguages: ['de', 'en'], requireAllAudioLanguages: true }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText(/must carry German and English/)).toBeTruthy()
    // The part everyone gets wrong, said out loud.
    expect(screen.getByText(/names no language at all is still allowed/)).toBeTruthy()
  })
})

describe('QualityRequirementsFields | language placement', () => {
  it('offers language rules to a book or music profile, which has no video rules', () => {
    render(
      <QualityRequirementsFields
        value={DEFAULT_REQUIREMENTS}
        onChange={vi.fn()}
        showVideoRules={false}
      />
    )

    expect(screen.getByRole('heading', { name: 'Language' })).toBeTruthy()
    // The video-only rules stay hidden, which is the point of the flag.
    expect(screen.queryByRole('heading', { name: 'Video' })).toBeNull()
  })
})

describe('AudioLanguageRules | original language', () => {
  it('offers the original-language token in the picker', async () => {
    const onChange = vi.fn()
    render(<AudioLanguageRules value={empty} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Search languages'), 'orig')
    await userEvent.click(screen.getByRole('button', { name: /Original language/ }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ requiredAudioLanguages: ['original'] })
    )
  })

  it('shows a chosen original-language rule as a row', () => {
    render(
      <AudioLanguageRules
        value={{ ...empty, requiredAudioLanguages: ['original'] }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('Original language')).toBeInTheDocument()
    // The token is not an ISO code, so the code chip says how it resolves
    expect(screen.getByText('per title')).toBeInTheDocument()
  })

  it('reads the token as words in the summary, never as a bare code', () => {
    render(
      <AudioLanguageRules
        value={{ ...empty, requiredAudioLanguages: ['original'] }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText(/must carry the original language/)).toBeInTheDocument()
    expect(screen.queryByText(/ORIGINAL/)).not.toBeInTheDocument()
  })

  it('can sit alongside an explicit language', () => {
    render(
      <AudioLanguageRules
        value={{ ...empty, requiredAudioLanguages: ['original', 'en'] }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('Original language')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
  })
})
