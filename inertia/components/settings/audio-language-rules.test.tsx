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
      <AudioLanguageRules value={{ ...empty, requiredAudioLanguages: ['de'] }} onChange={onChange} />
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
