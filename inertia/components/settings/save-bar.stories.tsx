import type { Meta, StoryObj } from '@storybook/react'
import { RowGroup } from './row-group'
import { SaveBar, useFormDraft } from './save-bar'
import { FieldRow } from './setting-row'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const meta: Meta<typeof SaveBar> = {
  component: SaveBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof SaveBar>

function NamingForm({ fail = false }: { fail?: boolean }) {
  const form = useFormDraft({
    artistFolder: '{Artist Name}',
    albumFolder: '{Album Title} ({Release Year})',
    trackFile: '{Track Number:00} - {Track Title}',
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 p-4">
      <RowGroup>
        <FieldRow
          label="Artist folder format"
          value={form.draft.artistFolder}
          onChange={(value) => form.set('artistFolder', value)}
          mono
        />
        <FieldRow
          label="Album folder format"
          value={form.draft.albumFolder}
          onChange={(value) => form.set('albumFolder', value)}
          mono
        />
        <FieldRow
          label="Track file format"
          value={form.draft.trackFile}
          onChange={(value) => form.set('trackFile', value)}
          mono
        />
      </RowGroup>
      {/* Tall filler so the bar's stickiness is visible. */}
      <div className="h-[120vh] rounded-xl border border-dashed border-border" />
      <SaveBar
        dirty={form.dirty}
        saving={form.saving}
        error={form.error}
        onDiscard={form.discard}
        onSave={() =>
          void form.save(async () => {
            await wait(600)
            if (fail) throw new Error('Track file format needs {Track Title}.')
          })
        }
      />
    </div>
  )
}

export const EditToShow: Story = {
  render: () => <NamingForm />,
}

export const FailingSave: Story = {
  render: () => <NamingForm fail />,
}

export const AlwaysVisible: Story = {
  args: { dirty: true, onSave: () => {}, onDiscard: () => {} },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
}

export const Dark: Story = { ...AlwaysVisible, globals: { theme: 'dark' } }

export const Phone: Story = { ...AlwaysVisible, globals: { viewport: { value: 'phone' } } }
