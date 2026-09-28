import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { DownloadClientsSettings } from './download-clients-settings'
import { clientsFetchStub } from './clients_fixtures'

/**
 * Settings → Download clients against a canned API: qBittorrent unreachable,
 * NZBGet needing a path mapping, SABnzbd fine and Transmission switched off.
 */

type Stub = ReturnType<typeof clientsFetchStub>
let current: Stub = clientsFetchStub()

function install(stub: Stub) {
  current = stub
  const w = window as typeof window & { __clientsFetchStub?: boolean }
  if (w.__clientsFetchStub) return
  w.__clientsFetchStub = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!/^\/api\/v1\/(downloadclients|system\/health)/.test(url)) return realFetch(input, init)
    await new Promise((resolve) => setTimeout(resolve, 200))
    return current(input, init)
  }
}

function Frame({ stub, children }: { stub: Stub; children: ReactNode }) {
  install(stub)
  return (
    <div className="w-full px-4 py-6">
      {children}
      <Toaster />
    </div>
  )
}

const meta: Meta = {
  title: 'Settings/Download clients',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

export const Page: Story = {
  render: () => (
    <Frame stub={clientsFetchStub()}>
      <DownloadClientsSettings />
    </Frame>
  ),
}
export const PageDark: Story = { ...Page, globals: { theme: 'dark' } }
export const PagePhone: Story = { ...Page, globals: { viewport: { value: 'phone' } } }
export const PagePhoneDark: Story = {
  ...Page,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}

export const Empty: Story = {
  render: () => (
    <Frame stub={clientsFetchStub({ clients: [] })}>
      <DownloadClientsSettings />
    </Frame>
  ),
}
