import {
  SETTINGS_NAV,
  activeSettingsItem,
  isSettingsPath,
  visibleSettingsNav,
} from './settings_nav'

describe('SETTINGS_NAV', () => {
  it('has the planned groups in order', () => {
    expect(SETTINGS_NAV.map((g) => g.label)).toEqual([
      'Library',
      'Downloading',
      'Connect',
      'System',
      'You',
    ])
  })

  it('gives every item a unique id and URL', () => {
    const items = SETTINGS_NAV.flatMap((g) => g.items)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
    expect(new Set(items.map((i) => i.url)).size).toBe(items.length)
  })

  it('leaves only Profile to non-admins', () => {
    const groups = visibleSettingsNav(false)
    expect(groups.map((g) => g.label)).toEqual(['You'])
    expect(groups[0].items.map((i) => i.label)).toEqual(['Profile'])
  })

  it('shows admins everything', () => {
    const count = visibleSettingsNav(true).flatMap((g) => g.items).length
    expect(count).toBe(SETTINGS_NAV.flatMap((g) => g.items).length)
  })
})

describe('activeSettingsItem', () => {
  it('is null on the Overview', () => {
    expect(activeSettingsItem('/settings')).toBeNull()
    expect(activeSettingsItem('/settings?x=1')).toBeNull()
  })

  it('matches a page by path, ignoring query and fragment', () => {
    expect(activeSettingsItem('/settings/notifications#deliveries')?.id).toBe('notifications')
    expect(activeSettingsItem('/settings/system?tab=1')?.id).toBe('system')
    expect(activeSettingsItem('/settings/profile')?.id).toBe('profile')
  })

  it('gives Media, Quality and Discovery a page each', () => {
    expect(activeSettingsItem('/settings/media#playback')?.id).toBe('media')
    expect(activeSettingsItem('/settings/quality?type=tv')?.id).toBe('quality')
    expect(activeSettingsItem('/settings/discovery#accounts')?.id).toBe('discovery')
    // The old combined page is only a redirect now.
    expect(activeSettingsItem('/settings/media-management')).toBeNull()
  })

  it('does not match a path that merely starts with the same letters', () => {
    expect(activeSettingsItem('/settings/systemx')).toBeNull()
  })
})

describe('isSettingsPath', () => {
  it('covers the Overview and every subpage, nothing else', () => {
    expect(isSettingsPath('/settings')).toBe(true)
    expect(isSettingsPath('/settings/indexers')).toBe(true)
    expect(isSettingsPath('/settingsx')).toBe(false)
    expect(isSettingsPath('/activity')).toBe(false)
  })
})
