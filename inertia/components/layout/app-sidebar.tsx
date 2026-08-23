import { Link, usePage } from '@inertiajs/react'
import { useState, useEffect } from 'react'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'
import {
  MusicNote01Icon,
  Download04Icon,
  Search01Icon,
  Folder01Icon,
  LogoutSquare01Icon,
  UserIcon,
  Globe02Icon,
  Video01Icon,
  Notification01Icon,
  Link01Icon,
  Calendar03Icon,
  Settings02Icon,
  UserMultipleIcon,
  DashboardSquare01Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons'
import { HamsterIcon } from '@/components/icons/hamster-icon'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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
    title: 'Calendar',
    url: '/calendar',
    icon: Calendar03Icon,
  },
  {
    title: 'Search',
    url: '/search',
    icon: Search01Icon,
  },
]

const activityNavItems: NavItem[] = [
  {
    title: 'Activity',
    url: '/activity/queue',
    icon: Download04Icon,
  },
  {
    title: 'History',
    url: '/activity/history',
    icon: Clock01Icon,
  },
]

const settingsNavItems: NavItem[] = [
  {
    title: 'Media Management',
    url: '/settings/media-management',
    icon: Folder01Icon,
  },
  {
    title: 'Indexers',
    url: '/settings/indexers',
    icon: Globe02Icon,
  },
  {
    title: 'Download Clients',
    url: '/settings/download-clients',
    icon: Download04Icon,
  },
  {
    title: 'Notifications',
    url: '/settings/notifications',
    icon: Notification01Icon,
  },
  {
    title: 'Webhooks',
    url: '/settings/webhooks',
    icon: Link01Icon,
  },
  {
    title: 'Playback',
    url: '/settings/playback',
    icon: Video01Icon,
  },
  {
    title: 'Users',
    url: '/settings/users',
    icon: UserMultipleIcon,
  },
]

const systemNavItems: NavItem[] = [
  {
    title: 'Status',
    url: '/system/status',
    icon: Settings02Icon,
  },
  {
    title: 'Events',
    url: '/system/events',
    icon: Notification01Icon,
  },
]

export function AppSidebar() {
  const { url, props } = usePage<{
    user?: { fullName?: string; email: string; isAdmin?: boolean }
    version: string
  }>()
  const { user, version } = props
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (itemUrl: string) => {
    return url.startsWith(itemUrl)
  }

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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
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
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Activity</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activityNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link href={item.url}>
                      <HugeiconsIcon icon={item.icon} className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link href={item.url}>
                        <HugeiconsIcon icon={item.icon} className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {user?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {systemNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link href={item.url}>
                        <HugeiconsIcon icon={item.icon} className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="readout px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          v{version}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ring-sidebar-ring/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:px-0"
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback>
                        {user?.fullName?.[0]?.toUpperCase() ||
                          user?.email?.[0]?.toUpperCase() ||
                          'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">{user?.fullName || 'User'}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                    </div>
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
                      Profile Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/logout" method="post" as="button" className="w-full">
                      <HugeiconsIcon icon={LogoutSquare01Icon} className="size-4" />
                      Log out
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm group-data-[collapsible=icon]:px-0"
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback>
                    {user?.fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">{user?.fullName || 'User'}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </button>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
