import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Shell from './Shell'
import { fetchUsers, setRole, fetchLinks, linkCoachStudent, unlinkCoachStudent } from '../lib/admin'

const ROLES = ['superadmin', 'coach', 'student']

export default function SuperadminDashboard() {
  const { t } = useTranslation()
  const [users, setUsers] = useState(null)
  const [links, setLinks] = useState([])
  const [error, setError] = useState(null)
  const [linkForm, setLinkForm] = useState({ coach: '', student: '' })

  function load() {
    fetchUsers().then(setUsers).catch((e) => { setError(e.message); setUsers([]) })
    fetchLinks().then(setLinks).catch(() => {})
  }
  useEffect(() => { load() }, [])

  async function onRole(id, role) {
    setError(null)
    try { await setRole(id, role); load() } catch (e) { setError(e.message) }
  }
  async function onLink() {
    if (!linkForm.coach || !linkForm.student) return
    setError(null)
    try { await linkCoachStudent(linkForm.coach, linkForm.student); setLinkForm({ coach: '', student: '' }); load() }
    catch (e) { setError(e.message) }
  }
  async function onUnlink(c, s) {
    setError(null)
    try { await unlinkCoachStudent(c, s); load() } catch (e) { setError(e.message) }
  }

  const name = (u) => u.display_name || u.email
  const coaches = (users || []).filter((u) => u.role === 'coach')
  const students = (users || []).filter((u) => u.role === 'student')

  return (
    <Shell>
      <h3 style={{ marginTop: 0 }}>{t('admin.title')}</h3>
      {error && <p style={{ color: '#c0392b' }}>{t('practice.error')}: {error}</p>}
      {users === null && <p style={{ color: '#777' }}>{t('auth.loading')}</p>}

      {users && (
        <div style={{ maxWidth: 720 }}>
          {users.map((u) => (
            <div key={u.id} style={{ display: 'flex', gap: 16, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ minWidth: 240 }}>{u.email}</span>
              <span style={{ color: '#666', minWidth: 110 }}>{u.display_name}</span>
              <select value={u.role} onChange={(e) => onRole(u.id, e.target.value)} style={{ marginLeft: 'auto', padding: 6 }}>
                {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
              </select>
            </div>
          ))}

          <h4 style={{ marginTop: 26, marginBottom: 8 }}>{t('admin.links')}</h4>
          {links.length === 0 && <p style={{ color: '#999', margin: '2px 0' }}>{t('admin.noLinks')}</p>}
          {links.map((l) => (
            <div key={l.coach_id + l.student_id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '3px 0' }}>
              <span>{(l.coach_name || l.coach_id.slice(0, 8))} → {(l.student_name || l.student_id.slice(0, 8))}</span>
              <button onClick={() => onUnlink(l.coach_id, l.student_id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#c0392b', textDecoration: 'underline', cursor: 'pointer' }}>
                {t('assign.delete')}
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <select value={linkForm.coach} onChange={(e) => setLinkForm((f) => ({ ...f, coach: e.target.value }))} style={{ padding: 6 }}>
              <option value="">{t('admin.pickCoach')}</option>
              {coaches.map((u) => <option key={u.id} value={u.id}>{name(u)}</option>)}
            </select>
            <span>→</span>
            <select value={linkForm.student} onChange={(e) => setLinkForm((f) => ({ ...f, student: e.target.value }))} style={{ padding: 6 }}>
              <option value="">{t('admin.pickStudent')}</option>
              {students.map((u) => <option key={u.id} value={u.id}>{name(u)}</option>)}
            </select>
            <button onClick={onLink} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2d6cdf', background: '#2d6cdf', color: '#fff', cursor: 'pointer' }}>
              {t('admin.addLink')}
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}
