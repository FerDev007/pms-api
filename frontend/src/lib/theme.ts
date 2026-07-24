import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
const KEY = 'pms-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getStoredTheme(): Theme {
  const value = localStorage.getItem(KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

// Aplica el tema resuelto (claro/oscuro) al <html> y sincroniza el color de la barra
// del navegador. 'system' sigue la preferencia del sistema operativo.
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && media().matches)
  const root = document.documentElement
  root.setAttribute('data-theme', dark ? 'dark' : 'light')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#181715' : '#f6f4ef')
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  const setTheme = (next: Theme) => {
    localStorage.setItem(KEY, next)
    setThemeState(next)
    applyTheme(next)
  }

  // Cuando está en 'system', reacciona a que el SO cambie de claro a oscuro en vivo.
  useEffect(() => {
    if (theme !== 'system') return
    const mq = media()
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return { theme, setTheme }
}
