import { useTranslation } from 'react-i18next'
import Shell from './Shell'
export default function SuperadminDashboard() {
  const { t } = useTranslation()
  return <Shell><p>{t('dashboard.emptyAdmin')}</p></Shell>
}
