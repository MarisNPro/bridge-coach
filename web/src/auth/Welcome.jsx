import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthProvider'
import { markWelcomed } from '../lib/onboarding'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// One-time welcome screen shown right after onboarding (SB-3). Routing gates on
// profile.welcomed_at; continuing stamps it and falls through to the dashboard.
export default function Welcome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try {
      await markWelcomed(session.user.id)
      await refreshProfile()
    } catch { /* non-blocking — fall through to the app regardless */ }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-1 text-center">
          <div className="text-lg font-semibold">
            {t('welcome.title', { name: profile?.display_name || '' })}
          </div>
          <p className="text-sm text-muted-foreground">{t('welcome.body')}</p>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={go} disabled={busy}>{t('welcome.cta')}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
