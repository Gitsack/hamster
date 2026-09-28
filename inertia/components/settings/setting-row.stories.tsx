import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { RowGroup } from './row-group'
import {
  CredentialRow,
  FieldRow,
  LinkRow,
  ReadoutRow,
  SelectRow,
  SettingRow,
  ToggleRow,
} from './setting-row'
import { StatusDot } from '@/components/status-badge'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const meta: Meta<typeof SettingRow> = {
  component: SettingRow,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof SettingRow>

function AllVariants() {
  const [accel, setAccel] = useState(true)
  const [accelType, setAccelType] = useState('vaapi')
  const [maxLanes, setMaxLanes] = useState('6')
  const [tmdbSet, setTmdbSet] = useState(false)

  return (
    <RowGroup>
      <ToggleRow
        label="Hardware acceleration"
        description="Transcode on the GPU when one is detected."
        checked={accel}
        onSave={async (next) => {
          await wait(400)
          setAccel(next)
        }}
      />
      <ToggleRow
        label="Personalised lanes"
        description="This one always fails, to show the revert."
        checked={false}
        onSave={async () => {
          await wait(400)
          throw new Error('HTTP 500 · Internal Server Error')
        }}
      />
      <SelectRow
        label="Acceleration type"
        description="VAAPI covers Intel and AMD on Linux."
        value={accelType}
        options={[
          { value: 'vaapi', label: 'VAAPI' },
          { value: 'qsv', label: 'Intel Quick Sync' },
          { value: 'nvenc', label: 'NVIDIA NVENC' },
        ]}
        disabled={!accel}
        onSave={async (next) => {
          await wait(400)
          setAccelType(next)
        }}
      />
      <FieldRow
        label="Maximum lanes"
        description="Rows of recommendations on Discover."
        type="number"
        inputMode="numeric"
        min={1}
        max={20}
        value={maxLanes}
        onChange={setMaxLanes}
        suffix="lanes"
        mono
      />
      <FieldRow
        label="Artist folder format"
        value="{Artist Name"
        onChange={() => {}}
        error="Close the brace: {Artist Name}."
        mono
      />
      <CredentialRow
        label="TMDB API key"
        description="Movie and TV metadata, artwork and streaming offers."
        isSet={tmdbSet}
        onSave={async () => {
          await wait(400)
          setTmdbSet(true)
        }}
        onRemove={async () => {
          await wait(400)
          setTmdbSet(false)
        }}
        help="Create one under Settings → API on themoviedb.org."
      />
      <CredentialRow
        label="Simkl client ID"
        description="Optional. Unlocks trending lanes."
        isSet={false}
        required={false}
        onSave={() => {}}
      />
      <ReadoutRow label="Version" value="v1.37.0 · up 3d 4h · Node 22 · linux/x64 · RSS 312 MB" />
      <LinkRow
        label="Download clients"
        meta="SABnzbd unreachable: DNS"
        metaTone="error"
        trailing={<StatusDot tone="error" label="Failing" />}
        onClick={() => {}}
      />
      <LinkRow label="Indexers" meta="Prowlarr syncing · 14 indexers" onClick={() => {}} />
    </RowGroup>
  )
}

export const Variants: Story = {
  render: () => <AllVariants />,
}

export const Dark: Story = { ...Variants, globals: { theme: 'dark' } }

export const Phone: Story = { ...Variants, globals: { viewport: { value: 'phone' } } }

export const PhoneDark: Story = {
  ...Variants,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}
