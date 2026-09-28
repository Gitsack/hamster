import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { UsersSettings } from './users-settings'
import { usersFetchStub } from './users_fixtures'

/** Settings → Users & access against a canned API: three accounts, local access on. */

type Stub = ReturnType<typeof usersFetchStub>
let current: Stub = usersFetchStub()

function install(stub: Stub) {
  current = stub
  const w = window as typeof window & { __usersFetchStub?: boolean }
  if (w.__usersFetchStub) return
  w.__usersFetchStub = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!/^\/api\/v1\/(users|settings\/local-access)/.test(url)) return realFetch(input, init)
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
  title: 'Settings/Users & access',
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj

export const Page: Story = {
  render: () => (
    <Frame stub={usersFetchStub()}>
      <UsersSettings currentUserId="u-me" />
    </Frame>
  ),
}
export const PageDark: Story = { ...Page, globals: { theme: 'dark' } }
export const PagePhone: Story = { ...Page, globals: { viewport: { value: 'phone' } } }
export const PagePhoneDark: Story = {
  ...Page,
  globals: { theme: 'dark', viewport: { value: 'phone' } },
}
