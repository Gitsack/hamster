import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { IndexersSettings } from './indexers-settings'
import {
  PROWLARR_STATUS_FIXTURE,
  PROWLARR_UNCONFIGURED,
  indexersFetchStub,
} from './indexers_fixtures'

/**
 * Settings → Indexers against a canned API: Prowlarr answering with 14
 * indexers, one direct indexer on and one off.
 */

type Stub = ReturnType<typeof indexersFetchStub>
let current: Stub = indexersFetchStub()

function install(stub: Stub) {
  current = stub
  const w = window as typeof window & { __indexersFetchStub?: boolean }
  if (w.__indexersFetchStub) return
  w.__indexersFetchStub = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!/^\/api\/v1\/(indexers|prowlarr)/.test(url)) return realFetch(input, init)
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
  title: 'Settings/Indexers',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

export const Page: Story = {
  render: () => (
    <Frame stub={indexersFetchStub()}>
      <IndexersSettings />
    </Frame>
  ),
}
export const PageDark: Story = { ...Page, globals: { theme: 'dark' } }
export const PagePhone: Story = { ...Page, globals: { viewport: { value: 'phone' } } }

export const ProwlarrDown: Story = {
  render: () => (
    <Frame
      stub={indexersFetchStub({
        status: {
          ...PROWLARR_STATUS_FIXTURE,
          reachable: false,
          indexers: null,
          error: 'getaddrinfo EAI_AGAIN prowlarr',
        },
      })}
    >
      <IndexersSettings />
    </Frame>
  ),
}
export const ProwlarrDownPhoneDark: Story = {
  ...ProwlarrDown,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}

export const NothingSearched: Story = {
  render: () => (
    <Frame stub={indexersFetchStub({ prowlarr: PROWLARR_UNCONFIGURED, indexers: [] })}>
      <IndexersSettings />
    </Frame>
  ),
}
