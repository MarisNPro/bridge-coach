import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'

export default function Shell({ children }) {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const name = profile?.display_name || ''
  return (
    <div style={{ fontSize: 18, lineHeight: 1.5 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                       padding: '12px 20px', borderBottom: '1px solid #ddd' }}>
        <strong>{t('app.name')}</strong>
        <span>
          {profile && <em style={{ marginRight: 16 }}>{t(`roles.${profile.role}`)}</em>}
          <button onClick={signOut} style={{ fontSize: 16 }}>{t('auth.signOut')}</button>
        </span>
      </header>
      <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <h2>{t('dashboard.welcome', { name })}</h2>
        {children}
      </main>
    </div>
  )
}
