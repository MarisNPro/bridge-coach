import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import Shell from './Shell'
import { fetchUsers, setRole, fetchLinks, linkCoachStudent, unlinkCoachStudent } from '../lib/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

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
      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('admin.title')}</h2>
        {error && <p className="text-sm text-destructive">{t('practice.error')}: {error}</p>}
        {users === null && <p className="text-sm text-muted-foreground">{t('auth.loading')}</p>}

        {users && (
          <>
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {users.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="min-w-56 truncate">{u.email}</span>
                    <span className="text-sm text-muted-foreground">{u.display_name}</span>
                    <Select className="ml-auto max-w-44" value={u.role} onChange={(e) => onRole(u.id, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t('admin.links')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {links.length === 0 && <p className="text-sm text-muted-foreground">{t('admin.noLinks')}</p>}
                <div className="divide-y divide-border">
                  {links.map((l) => (
                    <div key={l.coach_id + l.student_id} className="flex items-center gap-2 py-2 text-sm">
                      <span>{l.coach_name || l.coach_id.slice(0, 8)}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span>{l.student_name || l.student_id.slice(0, 8)}</span>
                      <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-destructive"
                        onClick={() => onUnlink(l.coach_id, l.student_id)}>{t('assign.delete')}</Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Select className="max-w-52" value={linkForm.coach}
                    onChange={(e) => setLinkForm((f) => ({ ...f, coach: e.target.value }))}>
                    <option value="">{t('admin.pickCoach')}</option>
                    {coaches.map((u) => <option key={u.id} value={u.id}>{name(u)}</option>)}
                  </Select>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <Select className="max-w-52" value={linkForm.student}
                    onChange={(e) => setLinkForm((f) => ({ ...f, student: e.target.value }))}>
                    <option value="">{t('admin.pickStudent')}</option>
                    {students.map((u) => <option key={u.id} value={u.id}>{name(u)}</option>)}
                  </Select>
                  <Button size="sm" onClick={onLink}>{t('admin.addLink')}</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Shell>
  )
}
