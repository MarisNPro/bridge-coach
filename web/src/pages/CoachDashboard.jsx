import { useTranslation } from 'react-i18next'
import Shell from './Shell'
export default function CoachDashboard() {
  const { t } = useTranslation()
  return <Shell><p>{t('dashboard.emptyCoach')}</p></Shell>
}
