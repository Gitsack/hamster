import { createContext, useContext } from 'react'

/**
 * Set by SettingsLayout. Below md the app header's h1 already names the page
 * (the rail is gone and "‹ Settings" leads back to the list), so the page
 * header's own h2 steps back to screen readers only there.
 */
export const SettingsShellContext = createContext<{ inShell: boolean }>({ inShell: false })

export function useSettingsShell() {
  return useContext(SettingsShellContext)
}
