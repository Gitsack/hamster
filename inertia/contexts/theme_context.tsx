import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/**
 * Stable key shared with the no-FOUC bootstrap script in
 * `resources/views/inertia_layout.edge`. Changing it here means changing it there.
 */
export const THEME_STORAGE_KEY = 'hamster-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

interface ThemeContextValue {
  /** The stored preference: what the operator chose. */
  theme: Theme
  /** What is actually painted right now — `system` resolved against the OS. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const FALLBACK_THEME: ThemeContextValue = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    // Private mode, disabled storage, or a sandboxed iframe.
    return 'system'
  }
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const stored = readStoredTheme()
    return stored === 'system' ? readSystemTheme() : stored
  })

  // Apply the current preference, and follow the OS live while it is `system`.
  useEffect(() => {
    if (theme !== 'system') {
      setResolvedTheme(theme)
      applyTheme(theme)
      return
    }

    if (typeof window.matchMedia !== 'function') {
      setResolvedTheme('light')
      applyTheme('light')
      return
    }

    const query = window.matchMedia(DARK_QUERY)
    const sync = () => {
      const next: ResolvedTheme = query.matches ? 'dark' : 'light'
      setResolvedTheme(next)
      applyTheme(next)
    }

    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [theme])

  // Keep other tabs of the same install in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return
      setThemeState(isTheme(event.newValue) ? event.newValue : 'system')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Preference cannot be persisted; still apply it for this session.
    }
    setThemeState(next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

let warnedMissingProvider = false

/**
 * Outside a ThemeProvider (isolated tests, Storybook) this degrades to the
 * system default rather than throwing, so a component is never unmountable
 * because of theming alone.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    if (import.meta.env.DEV && !warnedMissingProvider) {
      warnedMissingProvider = true
      console.warn('useTheme() called outside ThemeProvider — falling back to the system theme.')
    }
    return FALLBACK_THEME
  }
  return context
}
