import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function signIn(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setBusy(false)
    if (error) { alert(error.message); return }
    setSent(true)
  }

  return (
    <div style={{ maxWidth: 360, margin: '15vh auto', fontSize: 18 }}>
      <h1>{t('app.name')}</h1>
      {sent ? (
        <p>{t('auth.checkEmail')}</p>
      ) : (
        <form onSubmit={signIn}>
          <label>{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 10, fontSize: 18, margin: '8px 0 16px' }}
          />
          <button type="submit" disabled={busy} style={{ padding: '10px 16px', fontSize: 18 }}>
            {busy ? t('auth.loading') : t('auth.signIn')}
          </button>
        </form>
      )}
    </div>
  )
}
