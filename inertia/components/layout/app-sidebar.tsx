import { Link, usePage } from '@inertiajs/react'
import { useState, useEffect } from 'react'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'
import {
  MusicNote01Icon,
  Download04Icon,
  Clock01Icon,
  Search01Icon,
  Folder01Icon,
  LogoutSquare01Icon,
  UserIcon,
  Globe02Icon,
  Video01Icon,
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
    title: 'Library',
    url: '/library',
    icon: MusicNote01Icon,
  },
  {
    title: 'Search',
    url: '/search',
    icon: Search01Icon,
  },
]

const activityNavItems: NavItem[] = [
  {
    title: 'Queue',
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
    title: 'Playback',
    url: '/settings/playback',
    icon: Video01Icon,
  },
]

export function AppSidebar() {
  const { url, props } = usePage<{ user?: { fullName?: string; email: string } }>()
  const user = props.user
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (itemUrl: string) => {
    return url.startsWith(itemUrl)
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <HamsterIcon className='size-6'  />
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
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {user?.fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
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
                    <Link href="/settings/ui">
                      <HugeiconsIcon icon={UserIcon} className="mr-2 size-4" />
                      Profile Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/logout" method="post" as="button" className="w-full">
                      <HugeiconsIcon icon={LogoutSquare01Icon} className="mr-2 size-4" />
                      Log out
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {user?.fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
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
