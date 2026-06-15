import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMyCoach, redeemCoachCode } from '@/lib/onboarding'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Settings → Coach. A student enters their coach's invite code to link; once
// linked, shows the coach's name instead (SB-5). Reuses the redeem_coach_code
// RPC; reads the current link via my_coach (migration 0015).
export default function CoachLink() {
  const { t } = useTranslation()
  const [coach, setCoach] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    getMyCoach().then((name) => { if (alive) setCoach(name) }).catch(() => {})
    return () => { alive = false }
  }, [])

  async function link(e) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true); setError(null)
    try {
      setCoach(await redeemCoachCode(code.trim()))
      setCode('')
    } catch (err) {
      const msg = String(err?.message || err)
      setError(/yourself/i.test(msg) ? t('settings.coachSelf') : t('settings.coachInvalid'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('settings.coachGroup')}
      </h4>
      {coach ? (
        <p className="text-sm">{t('settings.coachLinked', { name: coach })}</p>
      ) : (
        <form onSubmit={link} className="space-y-2">
          <label htmlFor="coach-code" className="text-sm font-medium">{t('settings.coachLinkLabel')}</label>
          <div className="flex gap-2">
            <Input id="coach-code" value={code} placeholder={t('settings.coachPlaceholder')}
              onChange={(e) => setCode(e.target.value)} />
            <Button type="submit" disabled={busy || !code.trim()}>{t('settings.coachLinkBtn')}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.coachLinkHint')}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}
    </section>
  )
}
