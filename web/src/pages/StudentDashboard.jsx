import { useTranslation } from 'react-i18next'
import Shell from './Shell'
export default function StudentDashboard() {
  const { t } = useTranslation()
  return <Shell><p>{t('dashboard.emptyStudent')}</p></Shell>
}
