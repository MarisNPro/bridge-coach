import { useTranslation } from 'react-i18next'
import { Moon, Sun, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useSettings } from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Shell({ children }) {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const { isDark, set } = useSettings()
  const name = profile?.display_name || ''
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">♠</span>
            <span>{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {profile && <Badge variant="secondary" className="mr-1">{t(`roles.${profile.role}`)}</Badge>}
            <Button
              variant="ghost"
              size="icon"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => set({ theme: isDark ? 'light' : 'dark' })}
            >
              {isDark ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> <span className="hidden sm:inline">{t('auth.signOut')}</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {name && <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('dashboard.welcome', { name })}</h1>}
        {children}
      </main>
    </div>
  )
}
