import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function signIn(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setBusy(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-base font-bold text-primary-foreground">♠</span>
            {t('app.name')}
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <MailCheck className="size-8 text-success" />
              <p className="text-sm text-muted-foreground">{t('auth.checkEmail')}</p>
            </div>
          ) : (
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">{t('auth.email')}</label>
                <Input id="email" type="email" value={email} required autoFocus
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t('auth.loading') : t('auth.signIn')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
