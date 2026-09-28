import type { Meta, StoryObj } from '@storybook/react'
import { useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { MediaSettings } from './media-settings'
import { QualitySettings } from './quality-settings'
import { DiscoverySettings } from './discovery-settings'
import { SETTINGS_FIXTURE, libraryFetchStub, type LibraryStubOptions } from './library_fixtures'
import type { MediaType } from './library_catalog'

/**
 * Settings → Media, Quality and Discovery against a canned API: movies, TV and
 * music on, the TV folder short on space, the music folder gone missing.
 */

let stub = libraryFetchStub()
const LIBRARY_API = [
  '/api/v1/settings',
  '/api/v1/rootfolders',
  '/api/v1/qualityprofiles',
  '/api/v1/customformats',
  '/api/v1/system/health-summary',
]

function installFetchStub(options: LibraryStubOptions) {
  stub = libraryFetchStub(options)
  const w = window as typeof window & { __libraryFetchStub?: boolean }
  if (w.__libraryFetchStub) return
  w.__libraryFetchStub = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!LIBRARY_API.some((prefix) => url.startsWith(prefix))) return realFetch(input, init)
    await new Promise((resolve) => setTimeout(resolve, 150))
    return stub(input, init)
  }
}

function Frame({ options = {}, children }: { options?: LibraryStubOptions; children: ReactNode }) {
  // Install before the first render so the page's first fetch hits the stub.
  useState(() => installFetchStub(options))
  return (
    <div className="w-full px-4 py-6">
      {children}
      <Toaster />
    </div>
  )
}

function QualityPage() {
  const [type, setType] = useState<MediaType | null>(null)
  return <QualitySettings type={type} onTypeChange={setType} />
}

const meta: Meta = {
  title: 'Settings/Library',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

export const Media: Story = {
  render: () => (
    <Frame>
      <MediaSettings />
    </Frame>
  ),
}
export const MediaDark: Story = { ...Media, globals: { theme: 'dark' } }
export const MediaPhone: Story = { ...Media, globals: { viewport: { value: 'phone' } } }

export const MediaWithoutTmdbKey: Story = {
  render: () => (
    <Frame
      options={{
        settings: { ...SETTINGS_FIXTURE, hasTmdbApiKey: false, enabledMediaTypes: ['music'] },
      }}
    >
      <MediaSettings />
    </Frame>
  ),
}

export const Quality: Story = {
  render: () => (
    <Frame>
      <QualityPage />
    </Frame>
  ),
}
export const QualityDark: Story = { ...Quality, globals: { theme: 'dark' } }
export const QualityPhone: Story = { ...Quality, globals: { viewport: { value: 'phone' } } }

export const Discovery: Story = {
  render: () => (
    <Frame>
      <DiscoverySettings />
    </Frame>
  ),
}
export const DiscoveryDark: Story = { ...Discovery, globals: { theme: 'dark' } }
export const DiscoveryPhone: Story = { ...Discovery, globals: { viewport: { value: 'phone' } } }

export const DiscoveryWithoutTmdbKey: Story = {
  render: () => (
    <Frame options={{ settings: { ...SETTINGS_FIXTURE, hasTmdbApiKey: false } }}>
      <DiscoverySettings />
    </Frame>
  ),
}
