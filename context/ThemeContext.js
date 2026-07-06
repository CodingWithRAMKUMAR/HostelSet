import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'hostelset-theme'
const MODES = ['light', 'dark', 'system']

export const ThemeContext = createContext(null)

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode) {
  if (typeof document === 'undefined') return
  const resolvedTheme = mode === 'system' ? getSystemTheme() : mode
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = resolvedTheme
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system')
  const [resolvedTheme, setResolvedTheme] = useState('light')

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY)
    const nextTheme = MODES.includes(storedTheme) ? storedTheme : 'system'
    setThemeState(nextTheme)
    setResolvedTheme(nextTheme === 'system' ? getSystemTheme() : nextTheme)
    applyTheme(nextTheme)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      setResolvedTheme(theme === 'system' ? getSystemTheme() : theme)
      applyTheme(theme)
    }
    media.addEventListener?.('change', handleSystemChange)
    media.addListener?.(handleSystemChange)
    return () => {
      media.removeEventListener?.('change', handleSystemChange)
      media.removeListener?.(handleSystemChange)
    }
  }, [theme])

  const setTheme = useCallback((nextTheme) => {
    const safeTheme = MODES.includes(nextTheme) ? nextTheme : 'system'
    localStorage.setItem(STORAGE_KEY, safeTheme)
    setThemeState(safeTheme)
    setResolvedTheme(safeTheme === 'system' ? getSystemTheme() : safeTheme)
    applyTheme(safeTheme)
  }, [])

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    modes: MODES,
  }), [theme, resolvedTheme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
