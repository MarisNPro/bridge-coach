import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Shell from './Shell'
import { fetchRoster, fetchStudentAttempts } from '../lib/coach'
import { Call } from '../practice/bridge'

export default function CoachDashboard() {
  const { t } = useTranslation()
  const [roster, setRoster] = useState(null)   // null = loading
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [attempts, setAttempts] = useState({}) // studentId -> rows | undefined

  useEffect(() => {
    fetchRoster().then(setRoster).catch((e) => { setError(e.message); setRoster([]) })
  }, [])

  async function toggle(sid) {
    if (openId === sid) { setOpenId(null); return }
    setOpenId(sid)
    if (attempts[sid] === undefined) {
      try {
        const rows = await fetchStudentAttempts(sid)
        setAttempts((m) => ({ ...m, [sid]: rows }))
      } catch (e) { setError(e.message) }
    }
  }

  const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '')

  return (
    <Shell>
      <h3 style={{ marginTop: 0 }}>{t('coach.title')}</h3>

      {error && <p style={{ color: '#c0392b' }}>{t('practice.error')}: {error}</p>}
      {roster === null && <p style={{ color: '#777' }}>{t('auth.loading')}</p>}
      {roster && roster.length === 0 && <p style={{ color: '#555' }}>{t('coach.noStudents')}</p>}

      {roster && roster.length > 0 && (
        <div style={{ maxWidth: 640 }}>
          {roster.map((s) => {
            const open = openId === s.student_id
            const rows = attempts[s.student_id]
            return (
              <div key={s.student_id} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
                <div
                  onClick={() => toggle(s.student_id)}
                  style={{ display: 'flex', gap: 16, alignItems: 'baseline', cursor: 'pointer' }}
                >
                  <strong style={{ minWidth: 150 }}>{s.display_name || s.student_id.slice(0, 8)}</strong>
                  <span>{t('coach.solvedOf', { solved: s.solved, total: s.total })}</span>
                  <span style={{ color: '#888', fontSize: 14 }}>
                    {s.last_attempt ? t('coach.lastActive', { date: fmtDate(s.last_attempt) }) : t('coach.noActivity')}
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#2d6cdf' }}>{open ? '▾' : '▸'}</span>
                </div>

                {open && (
                  <div style={{ margin: '8px 0 2px 6px' }}>
                    {rows === undefined && <p style={{ color: '#999', margin: '4px 0' }}>{t('auth.loading')}</p>}
                    {rows && rows.length === 0 && <p style={{ color: '#999', margin: '4px 0' }}>{t('coach.noActivity')}</p>}
                    {rows && rows.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '3px 0', fontSize: 15 }}>
                        <span style={{ width: 16, color: a.conformant ? '#2e7d32' : '#c0392b' }}>{a.conformant ? '✓' : '✗'}</span>
                        <span style={{ width: 120, color: '#555' }}>{a.deal_id}</span>
                        <span><Call value={a.your_call} /></span>
                        {!a.conformant && a.expected_call && (
                          <span style={{ color: '#888' }}>→ <Call value={a.expected_call} /></span>
                        )}
                        <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: 13 }}>{fmtDate(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Shell>
  )
}
