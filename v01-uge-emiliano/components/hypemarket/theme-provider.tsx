'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  DEFAULT_MODE,
  DEFAULT_SKIN,
  type SkinId,
  type ThemeMode,
} from './theme-config'

interface ThemeContextValue {
  skin: SkinId
  mode: ThemeMode
  setSkin: (skin: SkinId) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const SKIN_KEY = 'hm-skin'
const MODE_KEY = 'hm-mode'

function applyToDocument(skin: SkinId, mode: ThemeMode) {
  const root = document.documentElement
  root.setAttribute('data-skin', skin)
  root.setAttribute('data-mode', mode)
  root.style.colorScheme = mode
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<SkinId>(DEFAULT_SKIN)
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE)

  // Hydrate from what the no-flash script already wrote onto <html> so the
  // React state matches the pre-paint DOM (avoids a flash / mismatch).
  useEffect(() => {
    const root = document.documentElement
    const initialSkin = (root.getAttribute('data-skin') as SkinId) || DEFAULT_SKIN
    const initialMode =
      (root.getAttribute('data-mode') as ThemeMode) || DEFAULT_MODE
    setSkinState(initialSkin)
    setMode(initialMode)
  }, [])

  const setSkin = useCallback((next: SkinId) => {
    setSkinState(next)
    try {
      localStorage.setItem(SKIN_KEY, next)
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    const currentMode =
      (document.documentElement.getAttribute('data-mode') as ThemeMode) ||
      DEFAULT_MODE
    applyToDocument(next, currentMode)
  }, [])

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(MODE_KEY, next)
      } catch {
        // ignore storage failures
      }
      const currentSkin =
        (document.documentElement.getAttribute('data-skin') as SkinId) ||
        DEFAULT_SKIN
      applyToDocument(currentSkin, next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ skin, mode, setSkin, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/**
 * Runs before first paint (injected in <head>) to set data-skin / data-mode
 * from localStorage, preventing a flash of the default theme on reload.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var s=localStorage.getItem('${SKIN_KEY}')||'${DEFAULT_SKIN}';var m=localStorage.getItem('${MODE_KEY}')||'${DEFAULT_MODE}';var r=document.documentElement;r.setAttribute('data-skin',s);r.setAttribute('data-mode',m);r.style.colorScheme=m;}catch(e){var r=document.documentElement;r.setAttribute('data-skin','${DEFAULT_SKIN}');r.setAttribute('data-mode','${DEFAULT_MODE}');}})();`
