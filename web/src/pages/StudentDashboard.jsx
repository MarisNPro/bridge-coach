import { useTranslation } from 'react-i18next'
import Shell from './Shell'
import BidPractice from '../practice/BidPractice'

export default function StudentDashboard() {
  const { t } = useTranslation()
  return (
    <Shell>
      <h3 style={{ marginTop: 0 }}>{t('practice.title')}</h3>
      <BidPractice />
    </Shell>
  )
}
