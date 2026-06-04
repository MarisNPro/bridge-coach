import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Shell from './Shell'
import BidPractice from '../practice/BidPractice'
import { fetchStudentAssignments } from '../lib/assignments'

export default function StudentDashboard() {
  const { t } = useTranslation()
  const [assignments, setAssignments] = useState([])
  const [filter, setFilter] = useState(null) // situation id, or null = random

  useEffect(() => {
    fetchStudentAssignments().then(setAssignments).catch(() => setAssignments([]))
  }, [])

  const label = (id) => t(`sit.${id}`, { defaultValue: id })

  return (
    <Shell>
      <h3 style={{ marginTop: 0 }}>{t('practice.title')}</h3>

      {assignments.length > 0 && (
        <div style={{ margin: '0 0 20px', maxWidth: 560 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('assign.fromCoach')}</div>
          {assignments.map((a) => {
            const active = filter === a.situation
            return (
              <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '4px 0' }}>
                <span style={{ minWidth: 210 }}>{label(a.situation)}</span>
                <span style={{ color: '#555' }}>{t('assign.progress', { solved: a.solved, target: a.target })}</span>
                <button
                  onClick={() => setFilter(active ? null : a.situation)}
                  style={{ marginLeft: 'auto', padding: '3px 12px', borderRadius: 6,
                    border: '1px solid #2d6cdf', background: active ? '#2d6cdf' : '#fff',
                    color: active ? '#fff' : '#2d6cdf', cursor: 'pointer' }}
                >
                  {active ? t('assign.practicing') : t('assign.practice')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {filter && (
        <p style={{ color: '#555' }}>
          {t('assign.focused', { name: label(filter) })}{' '}
          <button onClick={() => setFilter(null)}
            style={{ background: 'none', border: 'none', color: '#2d6cdf', textDecoration: 'underline', cursor: 'pointer' }}>
            {t('assign.clearFocus')}
          </button>
        </p>
      )}

      <BidPractice only={filter} />
    </Shell>
  )
}
