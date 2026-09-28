import type { Meta, StoryObj } from '@storybook/react'
import { useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { SystemSettings } from './system-settings'
import { RestoreDialog } from './backups-section'
import { BACKUPS_FIXTURE, HEALTH_FIXTURE, systemFetchStub } from './system_fixtures'
import type { HealthSummary } from './system_api'

/**
 * Settings → System against a canned API: one download client down, a folder
 * short on space, and a backup task that keeps failing.
 */

let currentHealth: HealthSummary = HEALTH_FIXTURE

function installFetchStub(health: HealthSummary) {
  currentHealth = health
  const w = window as typeof window & { __systemFetchStub?: boolean }
  if (w.__systemFetchStub) return
  w.__systemFetchStub = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith('/api/v1/system/')) return realFetch(input, init)
    await new Promise((resolve) => setTimeout(resolve, 200))
    return systemFetchStub({ health: currentHealth })(input, init)
  }
}

function Frame({
  health = HEALTH_FIXTURE,
  children,
}: {
  health?: HealthSummary
  children: ReactNode
}) {
  installFetchStub(health)
  return (
    <div className="w-full px-4 py-6">
      {children}
      <Toaster />
    </div>
  )
}

const meta: Meta = {
  title: 'system/System',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

export const Page: Story = {
  render: () => (
    <Frame>
      <SystemSettings />
    </Frame>
  ),
}
export const PageDark: Story = { ...Page, globals: { theme: 'dark' } }
export const PagePhone: Story = { ...Page, globals: { viewport: { value: 'phone' } } }
export const PagePhoneDark: Story = {
  ...Page,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}

const HEALTHY: HealthSummary = {
  ...HEALTH_FIXTURE,
  level: 'ok',
  checks: HEALTH_FIXTURE.checks.map((c) => ({ ...c, status: 'ok' })),
  downloadClients: HEALTH_FIXTURE.downloadClients.map((c) => ({
    ...c,
    status: 'ok',
    message: 'Reachable',
    latencyMs: 18,
  })),
  rootFolders: HEALTH_FIXTURE.rootFolders.map((f) => ({ ...f, status: 'ok', message: 'Readable' })),
  failedTasks: [],
}

export const Healthy: Story = {
  render: () => (
    <Frame health={HEALTHY}>
      <SystemSettings />
    </Frame>
  ),
}

function RestoreStory() {
  const [open, setOpen] = useState(true)
  return (
    <Frame>
      <button type="button" className="text-sm underline" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <RestoreDialog backup={open ? BACKUPS_FIXTURE.backups[0] : null} onOpenChange={setOpen} />
    </Frame>
  )
}

export const Restore: Story = { render: () => <RestoreStory /> }
export const RestorePhoneDark: Story = {
  ...Restore,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}
