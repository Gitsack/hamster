import { Link } from '@inertiajs/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Settings02Icon } from '@hugeicons/core-free-icons'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { StatusDot } from '@/components/status-badge'
import {
  activeSettingsItem,
  visibleSettingsNav,
  type SettingsStatusKey,
} from '@/components/settings/settings_nav'

const RETURN_KEY = 'hamster.settings-return'
let returnUrl: string | null = null

/**
 * Remembers the last page outside settings, so "Back" in the settings sidebar
 * returns there rather than to a fixed page. Kept per tab: in memory, and in
 * sessionStorage so a reload inside settings still knows the way out.
 */
export function rememberReturnUrl(url: string) {
  returnUrl = url
  try {
    window.sessionStorage.setItem(RETURN_KEY, url)
  } catch {
    // Storage unavailable: the in-memory copy still covers this visit.
  }
}

function readReturnUrl(): string {
  if (returnUrl) return returnUrl
  try {
    return window.sessionStorage.getItem(RETURN_KEY) || '/dashboard'
  } catch {
    return '/dashboard'
  }
}

/**
 * The sidebar's contents while an admin is inside settings: a way back to the
 * app, the Overview, then every settings page in its group. It replaces the
 * main nav in the same sidebar, so settings pages get the full content width
 * and there is only ever one navigation column.
 */
export function SettingsSidebarNav({
  url,
  failing,
}: {
  url: string
  failing: Set<SettingsStatusKey>
}) {
  const current = activeSettingsItem(url)

  return (
    <nav aria-label="Settings" className="contents">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Back to app" className="text-muted-foreground">
                <Link href={readReturnUrl()}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                  <span>Back</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={current === null} tooltip="Overview">
                <Link href="/settings" aria-current={current === null ? 'page' : undefined}>
                  <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                  <span>Overview</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {visibleSettingsNav(true).map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = current?.id === item.id
                const down = item.statusKey ? failing.has(item.statusKey) : false
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.url} aria-current={active ? 'page' : undefined}>
                        <HugeiconsIcon icon={item.icon} className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {down && <FailingDot label={`${item.label} needs attention`} />}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  )
}

/** Trailing dot when expanded; a corner dot on the icon when collapsed. */
export function FailingDot({ label }: { label: string }) {
  return (
    <>
      <SidebarMenuBadge>
        <StatusDot tone="error" label={label} />
      </SidebarMenuBadge>
      <StatusDot
        tone="error"
        label={label}
        className="pointer-events-none absolute top-1.5 right-1.5 hidden group-data-[collapsible=icon]:block"
      />
    </>
  )
}
