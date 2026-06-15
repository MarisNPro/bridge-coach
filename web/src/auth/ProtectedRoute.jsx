import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthProvider'

export default function ProtectedRoute({ allow, children }) {
  const { session, profile, loading, needsOnboarding } = useAuth()
  const { t } = useTranslation()

  if (loading) return <p style={{ padding: 24 }}>{t('auth.loading')}</p>
  if (!session) return <Navigate to="/login" replace />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  if (allow && profile && !allow.includes(profile.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
