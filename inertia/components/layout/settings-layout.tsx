import type { ReactNode } from 'react'
import { Head, Link, usePage } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { AppLayout } from './app-layout'
import { activeSettingsItem } from '@/components/settings/settings_nav'
import { SettingsShellContext } from '@/components/settings/settings_shell'

type SettingsPageProps = {
  user?: { isAdmin?: boolean }
}

const SHELL = { inShell: true }

/**
 * The frame for every settings page: the app layout titled "Settings". The
 * settings pages themselves are listed in the app sidebar, which swaps to the
 * settings nav on these pages (see SettingsSidebarNav), so the content keeps
 * the full width.
 *
 * Below md the sidebar is a sheet, so /settings doubles as the drill-in list
 * and every other page names itself in the header with a "‹ Settings" link
 * back to that list.
 *
 * Non-admins can only open Profile, so they get no back link.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const { url, props } = usePage<SettingsPageProps>()
  const isAdmin = Boolean(props.user?.isAdmin)
  const current = activeSettingsItem(url)
  const pageTitle = current?.label ?? 'Settings'

  const heading = (
    <>
      {isAdmin && current && (
        <Link
          href="/settings"
          className="-ml-1 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md pr-2 pl-1 text-sm text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" className="size-4" />
          Settings
        </Link>
      )}
      <h1 className="min-w-0 truncate text-lg font-semibold">
        {current && isAdmin ? (
          <>
            <span className="md:hidden">{current.label}</span>
            <span className="hidden md:inline">Settings</span>
          </>
        ) : (
          pageTitle
        )}
      </h1>
    </>
  )

  return (
    <AppLayout headerPrefix={heading}>
      <Head title={pageTitle} />
      <SettingsShellContext.Provider value={SHELL}>{children}</SettingsShellContext.Provider>
    </AppLayout>
  )
}
