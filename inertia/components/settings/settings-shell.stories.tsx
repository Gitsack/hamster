import type { Meta, StoryObj } from '@storybook/react'
import { SettingsSidebarNav } from '@/components/layout/settings-sidebar-nav'
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SettingsOverviewList } from './settings-overview'
import { SettingsShellContext } from './settings_shell'
import type { SettingsStatusKey } from './settings_nav'
import { OVERVIEW_FAILING, OVERVIEW_NOW, OVERVIEW_OK } from './settings_overview_fixtures'
import type { SettingsOverview } from './settings_overview'

/**
 * The settings shell as the app composes it: the app sidebar in settings mode
 * (Back, Overview, every settings page) beside the full-width content column.
 * Below md the sidebar is a sheet and the Overview is the drill-in list.
 */
function Shell({
  overview,
  failing = [],
}: {
  overview: SettingsOverview | null
  failing?: SettingsStatusKey[]
}) {
  return (
    <SettingsShellContext.Provider value={{ inShell: true }}>
      <SidebarProvider>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarContent>
            <SettingsSidebarNav url="/settings" failing={new Set(failing)} />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="p-4">
          <SettingsOverviewList
            overview={overview}
            email="operator@example.com"
            now={OVERVIEW_NOW}
          />
        </SidebarInset>
      </SidebarProvider>
    </SettingsShellContext.Provider>
  )
}

const meta: Meta<typeof Shell> = {
  title: 'Settings/Shell',
  component: Shell,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Shell>

export const AllHealthy: Story = { args: { overview: OVERVIEW_OK } }

export const Failing: Story = {
  args: { overview: OVERVIEW_FAILING, failing: ['media', 'download-clients', 'system'] },
}

export const StatusUnavailable: Story = { args: { overview: null } }
