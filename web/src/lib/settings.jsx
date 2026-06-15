import { createContext, useContext, useEffect, useState } from 'react'

// Client-side display/training preferences (localStorage for v1; can move to the
// Supabase profile later so they follow a user across devices).
const KEY = 'bc.settings'
const DEFAULTS = {
  theme: 'system',     // 'light' | 'dark' | 'system'
  textSize: 'normal',  // 'normal' | 'large'
  deck: '4color',      // '4color' | '2color'
  cardStyle: 'minimalist', // play-surface card faces: 'minimalist' | 'illustrative'
  feedback: 'standard', // 'minimal' | 'standard' | 'detailed'
  weak2: 'standard',   // weak-two range preset: 'standard' | 'aggressive' | 'disciplined'
}

const Ctx = createContext(null)

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

function resolveDark(theme) {
  return theme === 'dark' || (theme === 'system' && prefersDark())
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolveDark(settings.theme))
    root.setAttribute('data-text', settings.textSize === 'large' ? 'large' : 'normal')
  }, [settings.theme, settings.textSize])

  // Follow the OS when on 'system'.
  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => document.documentElement.classList.toggle('dark', mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const value = {
    ...settings,
    isDark: resolveDark(settings.theme),
    set: (patch) => setSettings((s) => ({ ...s, ...patch })),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings must be used within <SettingsProvider>')
  return v
}
