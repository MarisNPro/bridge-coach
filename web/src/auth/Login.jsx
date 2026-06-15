import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { stashPendingOnboarding } from '../lib/onboarding'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

// Google sign-in stays hidden until the provider is configured. Set
// VITE_ENABLE_GOOGLE_AUTH=true once the OAuth credentials are in Supabase.
const GOOGLE_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true'
const SKILLS = ['beginner', 'improving', 'intermediate', 'advanced']

// One-screen sign-up (doc/onboarding/new-user-onboarding.md). New users give a
// nickname + experience and accept the Terms up front; the email path carries
// those answers as sign-up metadata so the profile is fully populated on first
// sign-in (handle_new_user, migration 0011/0012) — no separate wizard. Returning
// users switch to a minimal sign-in (no account is created on that path).
export default function Login() {
  const { t, i18n } = useTranslation()
  const { signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('signup') // 'signup' | 'signin'
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [skill, setSkill] = useState('beginner')
  const [agreed, setAgreed] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isSignup = mode === 'signup'
  const locale = i18n?.language || 'lv'

  function switchMode(next) { setMode(next); setError(null); setSent(false) }

  async function submit(e) {
    e.preventDefault()
    if (isSignup && !agreed) { setError(t('onboarding.termsRequired')); return }
    setBusy(true); setError(null)
    const options = isSignup
      ? { data: { display_name: nickname.trim() || null, skill_level: skill, terms_accepted: 'true', locale } }
      : { shouldCreateUser: false } // sign-in must not silently create an account
    const { error } = await supabase.auth.signInWithOtp({ email, options })
    setBusy(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  async function google() {
    if (isSignup) {
      if (!agreed) { setError(t('onboarding.termsRequired')); return }
      // OAuth can't carry app metadata; stash for apply-on-return (when enabled).
      stashPendingOnboarding({ displayName: nickname.trim() || null, skillLevel: skill, locale })
    }
    setBusy(true); setError(null)
    const { error } = await signInWithGoogle()
    if (error) { setBusy(false); setError(error.message) }
    // On success the browser redirects to Google, so no further state change here.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2 text-center">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-base font-bold text-primary-foreground">♠</span>
            {t('app.name')}
          </div>
          <p className="text-sm text-muted-foreground">
            {isSignup ? t('auth.createAccountSub') : t('auth.signInSub')}
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <MailCheck className="size-8 text-success" />
              <p className="text-sm text-muted-foreground">{t('auth.checkEmail')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {GOOGLE_ENABLED && (
                <>
                  <Button type="button" variant="outline" className="w-full"
                    onClick={google} disabled={busy}>
                    {t('auth.continueWithGoogle')}
                  </Button>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    {t('auth.or')}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">{t('auth.email')}</label>
                  <Input id="email" type="email" value={email} required autoFocus
                    onChange={(e) => setEmail(e.target.value)} />
                </div>

                {isSignup && (
                  <>
                    <div className="space-y-1.5">
                      <label htmlFor="nickname" className="text-sm font-medium">{t('auth.nickname')}</label>
                      <Input id="nickname" value={nickname} required
                        placeholder={t('auth.nicknamePlaceholder')}
                        onChange={(e) => setNickname(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="skill" className="text-sm font-medium">{t('auth.experience')}</label>
                      <Select id="skill" value={skill} onChange={(e) => setSkill(e.target.value)}>
                        {SKILLS.map((s) => (
                          <option key={s} value={s}>{t(`onboarding.skill.${s}`)}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm">
                        <input type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                          checked={agreed}
                          onChange={(e) => { setAgreed(e.target.checked); setError(null) }} />
                        <span>{t('onboarding.termsLabel')}</span>
                      </label>
                      <p className="pl-[26px] text-xs text-muted-foreground">
                        <a href="/terms" target="_blank" rel="noreferrer"
                          className="underline underline-offset-2 hover:text-foreground">{t('legal.terms')}</a>
                        {' · '}
                        <a href="/privacy" target="_blank" rel="noreferrer"
                          className="underline underline-offset-2 hover:text-foreground">{t('legal.privacy')}</a>
                      </p>
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? t('auth.loading') : isSignup ? t('auth.agreeAndContinue') : t('auth.signIn')}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground">
                {isSignup ? (
                  <>{t('auth.haveAccount')}{' '}
                    <button type="button" onClick={() => switchMode('signin')}
                      className="underline underline-offset-2 hover:text-foreground">{t('auth.signIn')}</button>
                  </>
                ) : (
                  <>{t('auth.noAccount')}{' '}
                    <button type="button" onClick={() => switchMode('signup')}
                      className="underline underline-offset-2 hover:text-foreground">{t('auth.createAccount')}</button>
                  </>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
