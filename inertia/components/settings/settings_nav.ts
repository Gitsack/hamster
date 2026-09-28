import type { IconSvgElement } from '@hugeicons/react'
import {
  Award01Icon,
  CloudDownloadIcon,
  Compass01Icon,
  Folder01Icon,
  Globe02Icon,
  Notification01Icon,
  ServerStack01Icon,
  UserIcon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons'

/**
 * Settings areas the server can report as failing, from the health monitor's
 * cache (the shared `systemHealth.failing` prop). Keep in step with
 * `SettingsStatusKey` in app/services/system/settings_status.ts.
 */
export type SettingsStatusKey = 'media' | 'download-clients' | 'system'

/** Keys for the Overview's status lines, one per settings page. */
export type SettingsItemId =
  | 'media'
  | 'quality'
  | 'discovery'
  | 'indexers'
  | 'download-clients'
  | 'notifications'
  | 'users'
  | 'system'
  | 'profile'

export interface SettingsNavItem {
  id: SettingsItemId
  label: string
  /** Where the item links. May carry a #fragment. */
  url: string
  icon: IconSvgElement
  adminOnly: boolean
  /** Shows a destructive dot in the settings sidebar while this area is failing. */
  statusKey?: SettingsStatusKey
}

export interface SettingsNavGroup {
  label: string
  items: SettingsNavItem[]
}

/**
 * The settings sidebar, the phone drill-in list and the Overview all come from
 * this one list. Labels are also the page titles.
 */
export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: 'Library',
    items: [
      {
        id: 'media',
        label: 'Media',
        url: '/settings/media',
        icon: Folder01Icon,
        adminOnly: true,
        statusKey: 'media',
      },
      {
        id: 'quality',
        label: 'Quality',
        url: '/settings/quality',
        icon: Award01Icon,
        adminOnly: true,
      },
      {
        id: 'discovery',
        label: 'Discovery',
        url: '/settings/discovery',
        icon: Compass01Icon,
        adminOnly: true,
      },
    ],
  },
  {
    label: 'Downloading',
    items: [
      {
        id: 'indexers',
        label: 'Indexers',
        url: '/settings/indexers',
        icon: Globe02Icon,
        adminOnly: true,
      },
      {
        id: 'download-clients',
        label: 'Download clients',
        url: '/settings/download-clients',
        icon: CloudDownloadIcon,
        adminOnly: true,
        statusKey: 'download-clients',
      },
    ],
  },
  {
    label: 'Connect',
    items: [
      {
        id: 'notifications',
        label: 'Notifications',
        url: '/settings/notifications',
        icon: Notification01Icon,
        adminOnly: true,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        id: 'users',
        label: 'Users & access',
        url: '/settings/users',
        icon: UserMultipleIcon,
        adminOnly: true,
      },
      {
        id: 'system',
        label: 'System',
        url: '/settings/system',
        icon: ServerStack01Icon,
        adminOnly: true,
        statusKey: 'system',
      },
    ],
  },
  {
    label: 'You',
    items: [
      {
        id: 'profile',
        label: 'Profile',
        url: '/settings/profile',
        icon: UserIcon,
        adminOnly: false,
      },
    ],
  },
]

/** The groups and items this user may open; empty groups are dropped. */
export function visibleSettingsNav(isAdmin: boolean): SettingsNavGroup[] {
  return SETTINGS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => isAdmin || !item.adminOnly),
  })).filter((group) => group.items.length > 0)
}

function pathOf(url: string): string {
  const cut = url.search(/[?#]/)
  const path = cut === -1 ? url : url.slice(0, cut)
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/**
 * The settings item for the current page, or null on the Overview. Matched on the
 * path alone; should two items ever share a page, the first one owns it so
 * only one item is ever active.
 */
export function activeSettingsItem(url: string): SettingsNavItem | null {
  const path = pathOf(url)
  for (const group of SETTINGS_NAV) {
    for (const item of group.items) {
      const itemPath = pathOf(item.url)
      if (path === itemPath || path.startsWith(`${itemPath}/`)) return item
    }
  }
  return null
}

/** True for any settings page, including the Overview. */
export function isSettingsPath(url: string): boolean {
  const path = pathOf(url)
  return path === '/settings' || path.startsWith('/settings/')
}
