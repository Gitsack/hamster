import { Link, usePage } from '@inertiajs/react'
import { useState, useEffect } from 'react'
import { FailingDot, rememberReturnUrl, SettingsSidebarNav } from './settings-sidebar-nav'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'
import {
  MusicNote01Icon,
  Download04Icon,
  Search01Icon,
  LogoutSquare01Icon,
  Login01Icon,
  UserIcon,
  Calendar03Icon,
  Bookmark01Icon,
  DashboardSquare01Icon,
  Settings02Icon,
  Sun03Icon,
  Moon02Icon,
  ComputerIcon,
} from '@hugeicons/core-free-icons'
import { HamsterIcon } from '@/components/icons/hamster-icon'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { attentionCount, useActivityCounts } from '@/hooks/use_active_downloads'
import { StatusDot } from '@/components/status-badge'
import {
  isSettingsPath,
  SETTINGS_NAV,
  type SettingsStatusKey,
} from '@/components/settings/settings_nav'
import { useTheme, type Theme } from '@/contexts/theme_context'
import { cn } from '@/lib/utils'

interface NavItem {
  title: string
  url: string
  icon: IconSvgElement
}

const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: DashboardSquare01Icon,
  },
  {
    title: 'Library',
    url: '/library',
    icon: MusicNote01Icon,
  },
  {
    title: 'Watchlist',
    url: '/watchlist',
    icon: Bookmark01Icon,
  },
  {
    title: 'Calendar',
    url: '/calendar',
    icon: Calendar03Icon,
  },
  {
    title: 'Search',
    url: '/search',
    icon: Search01Icon,
  },
  {
    title: 'Activity',
    url: '/activity',
    icon: Download04Icon,
  },
]

type SidebarMode = 'main' | 'settings'

/**
 * The mode the sidebar last rendered in, across page loads. Pages mount their
 * own layout, so the sidebar remounts on every visit; this is how it knows it
 * just crossed into or out of settings and should slide.
 */
let lastMode: SidebarMode | null = null

const THEME_OPTIONS: { value: Theme; label: string; icon: IconSvgElement }[] = [
  { value: 'system', label: 'System', icon: ComputerIcon },
  { value: 'light', label: 'Light', icon: Sun03Icon },
  { value: 'dark', label: 'Dark', icon: Moon02Icon },
]

export function AppSidebar() {
  const { url, props } = usePage<{
    user?: { fullName?: string; email: string; isAdmin?: boolean; autoSignedIn?: boolean }
    version: string
    systemHealth?: SystemHealthProp
  }>()
  const { user, version, systemHealth } = props
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Admins get the settings pages in the sidebar itself; everyone else only
  // has Profile, which needs no navigation of its own.
  const mode: SidebarMode = user?.isAdmin && isSettingsPath(url) ? 'settings' : 'main'
  const [shown, setShown] = useState(() => ({
    mode,
    slide: lastMode !== null && lastMode !== mode ? mode : null,
  }))
  if (shown.mode !== mode) setShown({ mode, slide: mode })

  useEffect(() => {
    lastMode = mode
    if (mode === 'main') rememberReturnUrl(url)
  }, [mode, url])

  const isActive = (itemUrl: string) => {
    return url.startsWith(itemUrl)
  }

  const initial = user?.fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'
  const identity = (
    <>
      <Avatar className="size-8 shrink-0">
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold">{user?.fullName || 'User'}</span>
        <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
      </div>
    </>
  )

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Hamster">
              <Link href="/">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <HamsterIcon className="size-6" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Hamster</span>
                  <span className="truncate text-xs text-muted-foreground">Media Library</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent
        key={mode}
        className={cn(
          'overflow-x-hidden',
          shown.slide === 'settings' &&
            'motion-safe:animate-[sidebar-in_180ms_cubic-bezier(0.16,1,0.3,1)]',
          shown.slide === 'main' &&
            '[--sidebar-in-from:-12px] motion-safe:animate-[sidebar-in_180ms_cubic-bezier(0.16,1,0.3,1)]'
        )}
      >
        {mode === 'settings' ? (
          <SettingsSidebarNav url={url} failing={new Set(systemHealth?.failing ?? [])} />
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link href={item.url}>
                        <HugeiconsIcon icon={item.icon} className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.url === '/activity' && <ActivityBadge />}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        {mode === 'main' && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isSettingsPath(url)} tooltip="Settings">
                <Link href="/settings">
                  <HugeiconsIcon icon={Settings02Icon} className="size-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
              <SettingsHealthDot health={systemHealth} />
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {/* The one place the version shows; admins can follow it to the full About line. */}
        {user?.isAdmin ? (
          <Link
            href="/settings/system#about"
            className="readout w-fit rounded-sm px-2 text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 group-data-[collapsible=icon]:hidden"
          >
            v{version}
          </Link>
        ) : (
          <div className="readout px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            v{version}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ring-sidebar-ring/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:px-0"
                  >
                    {identity}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="min-w-56 rounded-lg"
                  side="top"
                  align="start"
                  sideOffset={4}
                >
                  <DropdownMenuItem asChild>
                    <Link href="/settings/profile">
                      <HugeiconsIcon icon={UserIcon} className="size-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Theme</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={theme}
                      onValueChange={(value) => setTheme(value as Theme)}
                    >
                      {THEME_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          closeOnClick={false}
                        >
                          <HugeiconsIcon icon={option.icon} className="size-4" />
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    {user?.autoSignedIn ? (
                      // Let in by local access: there is no session to end,
                      // but someone may want to sign in as another account.
                      <Link href="/login">
                        <HugeiconsIcon icon={Login01Icon} className="size-4" />
                        Sign in
                      </Link>
                    ) : (
                      <Link href="/logout" method="post" as="button" className="w-full">
                        <HugeiconsIcon icon={LogoutSquare01Icon} className="size-4" />
                        Log out
                      </Link>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm group-data-[collapsible=icon]:px-0"
              >
                {identity}
              </button>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * Downloads in flight plus anything that needs the operator. Destructive ink
 * the moment something has failed or stalled, so a failure is visible from any
 * page without opening Activity.
 */
function ActivityBadge() {
  const counts = useActivityCounts()
  if (!counts) return null
  const attention = attentionCount(counts)
  const total = counts.active + attention
  if (total === 0) return null

  const label =
    attention > 0
      ? `${attention} need${attention === 1 ? 's' : ''} attention, ${counts.active} downloading`
      : `${counts.active} downloading`

  return (
    <>
      <SidebarMenuBadge
        className={cn(
          attention > 0 &&
            'text-destructive peer-hover/menu-button:text-destructive peer-data-[active=true]/menu-button:text-destructive'
        )}
      >
        <span aria-hidden="true">{total}</span>
        <span className="sr-only">{label}</span>
      </SidebarMenuBadge>
      {/* Collapsed to icons the number has no room; a failure still shows as a dot. */}
      {attention > 0 && (
        <StatusDot
          tone="error"
          label={label}
          className="pointer-events-none absolute top-1.5 right-1.5 hidden group-data-[collapsible=icon]:block"
        />
      )}
    </>
  )
}

interface SystemHealthProp {
  healthLevel: 'ok' | 'warning' | 'error' | 'starting'
  failedTasks: number
  failing?: SettingsStatusKey[]
}

const STATUS_LABELS = new Map(
  SETTINGS_NAV.flatMap((group) => group.items)
    .filter((item) => item.statusKey)
    .map((item) => [item.statusKey!, item.label])
)

/**
 * A 6px destructive dot on Settings while any settings area is failing — a
 * download client or root folder is down, the database or the health loop is
 * in trouble, or a scheduled task failed its last run. The settings sidebar
 * shows which, once it is open. Shared on every page load from the monitor's memory cache (admins
 * only), so it costs no request.
 */
function SettingsHealthDot({ health }: { health?: SystemHealthProp }) {
  if (!health) return null
  const failing = health.failing ?? []
  if (failing.length === 0) return null

  const areas = failing.map((key) => STATUS_LABELS.get(key) ?? key)
  const label = `Settings needs attention: ${areas.join(', ')}`

  return <FailingDot label={label} />
}
