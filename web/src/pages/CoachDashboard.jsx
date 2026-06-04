import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Shell from './Shell'
import { fetchRoster, fetchStudentAttempts } from '../lib/coach'
import { fetchCoachAssignments, createAssignment, deleteAssignment } from '../lib/assignments'
import { SITUATIONS } from '../practice/generate'
import { Call } from '../practice/bridge'

export default function CoachDashboard() {
  const { t } = useTranslation()
  const [roster, setRoster] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [attempts, setAttempts] = useState({})
  const [form, setForm] = useState({ situation: SITUATIONS[0], target: 10 })

  const loadAssignments = () => fetchCoachAssignments().then(setAssignments).catch(() => {})
  useEffect(() => {
    fetchRoster().then(setRoster).catch((e) => { setError(e.message); setRoster([]) })
    loadAssignments()
  }, [])

  async function toggle(sid) {
    if (openId === sid) { setOpenId(null); return }
    setOpenId(sid)
    setForm({ situation: SITUATIONS[0], target: 10 })
    if (attempts[sid] === undefined) {
      try {
        const rows = await fetchStudentAttempts(sid)
        setAttempts((m) => ({ ...m, [sid]: rows }))
      } catch (e) { setError(e.message) }
    }
  }

  async function assign(studentId) {
    try {
      await createAssignment({ student_id: studentId, situation: form.situation, target: Number(form.target) || 10 })
      loadAssignments()
    } catch (e) { setError(e.message) }
  }
  async function removeAssignment(id) {
    try { await deleteAssignment(id); loadAssignments() } catch (e) { setError(e.message) }
  }

  const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '')
  const label = (id) => t(`sit.${id}`, { defaultValue: id })

  return (
    <Shell>
      <h3 style={{ marginTop: 0 }}>{t('coach.title')}</h3>
      {error && <p style={{ color: '#c0392b' }}>{t('practice.error')}: {error}</p>}
      {roster === null && <p style={{ color: '#777' }}>{t('auth.loading')}</p>}
      {roster && roster.length === 0 && <p style={{ color: '#555' }}>{t('coach.noStudents')}</p>}

      {roster && roster.length > 0 && (
        <div style={{ maxWidth: 700 }}>
          {roster.map((s) => {
            const open = openId === s.student_id
            const rows = attempts[s.student_id]
            const mine = assignments.filter((a) => a.student_id === s.student_id)
            return (
              <div key={s.student_id} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
                <div onClick={() => toggle(s.student_id)} style={{ display: 'flex', gap: 16, alignItems: 'baseline', cursor: 'pointer' }}>
                  <strong style={{ minWidth: 150 }}>{s.display_name || s.student_id.slice(0, 8)}</strong>
                  <span>{t('coach.solvedOf', { solved: s.solved, total: s.total })}</span>
                  <span style={{ color: '#888', fontSize: 14 }}>{s.last_attempt ? t('coach.lastActive', { date: fmtDate(s.last_attempt) }) : t('coach.noActivity')}</span>
                  <span style={{ marginLeft: 'auto', color: '#2d6cdf' }}>{open ? '▾' : '▸'}</span>
                </div>

                {open && (
                  <div style={{ margin: '10px 0 2px 6px' }}>
                    <div style={{ fontWeight: 600, margin: '6px 0' }}>{t('assign.heading')}</div>
                    {mine.length === 0 && <p style={{ color: '#999', margin: '2px 0' }}>{t('assign.none')}</p>}
                    {mine.map((a) => (
                      <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '2px 0', fontSize: 15 }}>
                        <span style={{ minWidth: 210 }}>{label(a.situation)}</span>
                        <span style={{ color: '#555' }}>{t('assign.progress', { solved: a.solved, target: a.target })}</span>
                        <button onClick={() => removeAssignment(a.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', textDecoration: 'underline' }}>{t('assign.delete')}</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                      <select value={form.situation} onChange={(e) => setForm((f) => ({ ...f, situation: e.target.value }))} style={{ padding: 6 }}>
                        {SITUATIONS.map((id) => <option key={id} value={id}>{label(id)}</option>)}
                      </select>
                      <input type="number" min="1" max="100" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} style={{ width: 64, padding: 6 }} />
                      <button onClick={() => assign(s.student_id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2d6cdf', background: '#2d6cdf', color: '#fff', cursor: 'pointer' }}>{t('assign.assignBtn')}</button>
                    </div>

                    <div style={{ fontWeight: 600, margin: '14px 0 4px' }}>{t('coach.recent')}</div>
                    {rows === undefined && <p style={{ color: '#999', margin: '2px 0' }}>{t('auth.loading')}</p>}
                    {rows && rows.length === 0 && <p style={{ color: '#999', margin: '2px 0' }}>{t('coach.noActivity')}</p>}
                    {rows && rows.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '3px 0', fontSize: 15 }}>
                        <span style={{ width: 16, color: a.conformant ? '#2e7d32' : '#c0392b' }}>{a.conformant ? '✓' : '✗'}</span>
                        <span style={{ width: 200, color: '#555' }}>{label(a.deal_id)}</span>
                        <span><Call value={a.your_call} /></span>
                        {!a.conformant && a.expected_call && <span style={{ color: '#888' }}>→ <Call value={a.expected_call} /></span>}
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
