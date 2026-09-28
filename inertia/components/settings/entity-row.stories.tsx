import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { action } from 'storybook/actions'
import { Delete02Icon, FlashIcon, Download04Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { EntityRow } from './entity-row'
import { RowGroup } from './row-group'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const meta: Meta<typeof EntityRow> = {
  component: EntityRow,
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

type Story = StoryObj<typeof EntityRow>

function Clients() {
  const [sabEnabled, setSabEnabled] = useState(true)
  const [nzbgetEnabled, setNzbgetEnabled] = useState(false)

  const actions = (name: string) => [
    { label: 'Test', icon: FlashIcon, onSelect: action(`test ${name}`) },
    {
      label: 'Delete',
      icon: Delete02Icon,
      destructive: true,
      onSelect: action(`delete ${name}`),
      confirm: {
        title: `Delete ${name}?`,
        description: 'Downloads already queued in the client are left alone.',
        confirmLabel: 'Delete client',
      },
    },
  ]

  return (
    <RowGroup>
      <EntityRow
        icon={Download04Icon}
        name="SABnzbd"
        status={<StatusBadge status="unreachable" />}
        meta={['sabnzbd:8080', 'category hamster']}
        error="getaddrinfo EAI_AGAIN sabnzbd — the container can't resolve DNS."
        enabled={sabEnabled}
        onEnabledChange={async (next) => {
          await wait(300)
          setSabEnabled(next)
        }}
        actions={actions('SABnzbd')}
        trailing={
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            Browse
          </Button>
        }
        onOpen={action('open SABnzbd')}
      />
      <EntityRow
        icon={Download04Icon}
        name="NZBGet on the NAS with a very long name that has to truncate"
        status={<StatusBadge tone="warning" label="Needs path mapping" />}
        meta={['nas.local:6789', 'category tv', '/downloads/complete']}
        enabled={nzbgetEnabled}
        onEnabledChange={async (next) => {
          await wait(300)
          setNzbgetEnabled(next)
        }}
        actions={actions('NZBGet')}
        onOpen={action('open NZBGet')}
      />
      <EntityRow
        icon={Search01Icon}
        name="NZBgeek"
        status={<StatusBadge status="reachable" />}
        meta={['Newznab', 'priority 25', 'last search 4m ago']}
        enabled
        onEnabledChange={async () => {
          await wait(300)
          throw new Error('HTTP 409 · Conflict')
        }}
        actions={actions('NZBgeek')}
        onOpen={action('open NZBgeek')}
      />
      <EntityRow
        name="Nightly backup"
        status={<StatusBadge status="completed" />}
        meta={['every 24h', 'last run 3h ago', '1.2s']}
      />
    </RowGroup>
  )
}

export const List: Story = {
  render: () => <Clients />,
}

export const Dark: Story = { ...List, globals: { theme: 'dark' } }

export const Phone: Story = { ...List, globals: { viewport: { value: 'phone' } } }

export const PhoneDark: Story = {
  ...List,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}
