import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useAuth } from './AuthProvider'
import { completeOnboarding, redeemCoachCode } from '../lib/onboarding'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const SKILLS = ['beginner', 'improving', 'intermediate', 'advanced']
const TOTAL = 4

// Post-auth onboarding wizard. Shown once, while profile.onboarded_at is null
// (routing in App.jsx gates on AuthProvider.needsOnboarding). Collects name +
// language, skill level, an optional coach code, and terms consent, then writes
// the profile and refreshes it so routing falls through to the dashboards.
export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, profile, refreshProfile } = useAuth()

  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile?.display_name || '')
  const [locale, setLocale] = useState(profile?.locale || 'lv')
  const [skill, setSkill] = useState(profile?.skill_level || 'beginner')
  const [code, setCode] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function pickLocale(value) {
    setLocale(value)
    i18n.changeLanguage(value) // reflect the choice live
  }

  const next = () => { setError(null); setStep((s) => Math.min(s + 1, TOTAL - 1)) }
  const back = () => { setError(null); setStep((s) => Math.max(s - 1, 0)) }

  async function finish() {
    if (!agreed) { setError(t('onboarding.termsRequired')); return }
    setBusy(true); setError(null)
    try {
      if (code.trim()) {
        try {
          await redeemCoachCode(code.trim())
        } catch {
          setBusy(false); setStep(2); setError(t('onboarding.codeInvalid')); return
        }
      }
      await completeOnboarding(session.user.id, { displayName: name, locale, skillLevel: skill })
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(e.message || String(e))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-1 text-center">
          <div className="text-lg font-semibold">{t('onboarding.title')}</div>
          <p className="text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
          <p className="text-xs text-muted-foreground">{t('onboarding.step', { n: step + 1, total: TOTAL })}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ob-name" className="text-sm font-medium">{t('onboarding.nameLabel')}</label>
                <Input id="ob-name" value={name} autoFocus
                  placeholder={t('onboarding.namePlaceholder')}
                  onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ob-lang" className="text-sm font-medium">{t('onboarding.languageLabel')}</label>
                <Select id="ob-lang" value={locale} onChange={(e) => pickLocale(e.target.value)}>
                  <option value="lv">Latviešu</option>
                  <option value="en">English</option>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-1.5">
              <label htmlFor="ob-skill" className="text-sm font-medium">{t('onboarding.skillLabel')}</label>
              <Select id="ob-skill" value={skill} autoFocus onChange={(e) => setSkill(e.target.value)}>
                {SKILLS.map((s) => (
                  <option key={s} value={s}>{t(`onboarding.skill.${s}`)}</option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">{t('onboarding.skillHint')}</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-1.5">
              <label htmlFor="ob-code" className="text-sm font-medium">{t('onboarding.codeLabel')}</label>
              <Input id="ob-code" value={code} autoFocus
                placeholder={t('onboarding.codePlaceholder')}
                onChange={(e) => setCode(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('onboarding.codeHint')}</p>
            </div>
          )}

          {step === 3 && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)} />
              <span>{t('onboarding.termsLabel')}</span>
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || busy}>
              {t('onboarding.back')}
            </Button>
            {step === 2 ? (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => { setCode(''); next() }} disabled={busy}>
                  {t('onboarding.skip')}
                </Button>
                <Button type="button" onClick={next} disabled={busy}>{t('onboarding.next')}</Button>
              </div>
            ) : step === TOTAL - 1 ? (
              <Button type="button" onClick={finish} disabled={busy}>
                {busy ? t('onboarding.saving') : t('onboarding.finish')}
              </Button>
            ) : (
              <Button type="button" onClick={next} disabled={busy}>{t('onboarding.next')}</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
