import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { action } from 'storybook/actions'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Delete02Icon, FlashIcon, Search01Icon } from '@hugeicons/core-free-icons'
import { SettingsPage } from './settings-page'
import { Section } from './section'
import { RowGroup } from './row-group'
import { CredentialRow, ReadoutRow, SelectRow, ToggleRow } from './setting-row'
import { EntityRow } from './entity-row'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const meta: Meta<typeof SettingsPage> = {
  component: SettingsPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof SettingsPage>

function IndexersPage({ loading = false }: { loading?: boolean }) {
  const [justwatch, setJustwatch] = useState(true)
  const [region, setRegion] = useState('DE')

  return (
    <SettingsPage
      title="Indexers"
      description="Where Hamster searches for releases."
      ready={!loading}
      actions={
        <Button size="sm" onClick={action('add indexer')}>
          <HugeiconsIcon icon={Add01Icon} aria-hidden="true" />
          Add indexer
        </Button>
      }
    >
      <Section
        id="prowlarr"
        title="Prowlarr"
        description="Indexers synced from one Prowlarr install."
      >
        <RowGroup loading={loading} skeletonRows={2}>
          <CredentialRow label="Prowlarr API key" isSet onSave={() => {}} />
          <ReadoutRow label="Sync" value="14 indexers synced · last sync 4m ago" />
        </RowGroup>
      </Section>

      <Section
        id="direct"
        title="Direct indexers"
        actions={
          <Button variant="ghost" size="sm" onClick={action('test all')}>
            Test all
          </Button>
        }
      >
        <RowGroup loading={loading}>
          <EntityRow
            icon={Search01Icon}
            name="NZBgeek"
            status={<StatusBadge status="unreachable" />}
            meta={['Newznab', 'api.nzbgeek.info', 'priority 25']}
            error="HTTP 401 · API key rejected · 3h ago"
            enabled
            onEnabledChange={() => wait(300)}
            actions={[
              { label: 'Test', icon: FlashIcon, onSelect: action('test') },
              {
                label: 'Delete',
                icon: Delete02Icon,
                destructive: true,
                onSelect: action('delete'),
                confirm: { title: 'Delete NZBgeek?', confirmLabel: 'Delete indexer' },
              },
            ]}
            onOpen={action('open NZBgeek')}
          />
          <EntityRow
            icon={Search01Icon}
            name="DrunkenSlug"
            status={<StatusBadge status="reachable" />}
            meta={['Newznab', 'api.drunkenslug.com', 'priority 25']}
            enabled
            onEnabledChange={() => wait(300)}
            onOpen={action('open DrunkenSlug')}
          />
        </RowGroup>
      </Section>

      <Section id="sources" title="Sources">
        <RowGroup loading={loading}>
          <ToggleRow
            label="JustWatch"
            description="Streaming availability on previews and detail pages."
            checked={justwatch}
            onSave={async (next) => {
              await wait(300)
              setJustwatch(next)
            }}
          />
          <SelectRow
            label="Region"
            value={region}
            options={[
              { value: 'DE', label: 'Germany' },
              { value: 'AT', label: 'Austria' },
              { value: 'US', label: 'United States' },
            ]}
            onSave={async (next) => {
              await wait(300)
              setRegion(next)
            }}
          />
        </RowGroup>
      </Section>
    </SettingsPage>
  )
}

export const Page: Story = {
  render: () => <IndexersPage />,
}

export const Loading: Story = {
  render: () => <IndexersPage loading />,
}

export const Dark: Story = { ...Page, globals: { theme: 'dark' } }

export const Phone: Story = { ...Page, globals: { viewport: { value: 'phone' } } }

export const PhoneDark: Story = {
  ...Page,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}
