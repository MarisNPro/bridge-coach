import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Check, X } from 'lucide-react'
import Shell from './Shell'
import { fetchRoster, fetchStudentAttempts } from '../lib/coach'
import { fetchCoachAssignments, createAssignment, deleteAssignment } from '../lib/assignments'
import { SITUATIONS } from '../practice/generate'
import { Call } from '../practice/bridge'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

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
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">{t('coach.title')}</h2>
        {error && <p className="text-sm text-destructive">{t('practice.error')}: {error}</p>}
        {roster === null && <p className="text-sm text-muted-foreground">{t('auth.loading')}</p>}
        {roster && roster.length === 0 && <p className="text-sm text-muted-foreground">{t('coach.noStudents')}</p>}

        {roster && roster.length > 0 && (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {roster.map((s) => {
                const open = openId === s.student_id
                const rows = attempts[s.student_id]
                const mine = assignments.filter((a) => a.student_id === s.student_id)
                return (
                  <div key={s.student_id}>
                    <button onClick={() => toggle(s.student_id)}
                      className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/50">
                      <span className="min-w-32 font-medium">{s.display_name || s.student_id.slice(0, 8)}</span>
                      <Badge variant="secondary">{t('coach.solvedOf', { solved: s.solved, total: s.total })}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {s.last_attempt ? t('coach.lastActive', { date: fmtDate(s.last_attempt) }) : t('coach.noActivity')}
                      </span>
                      <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                    </button>

                    {open && (
                      <div className="space-y-5 border-t border-border bg-muted/20 px-5 py-4">
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('assign.heading')}</h4>
                          {mine.length === 0 && <p className="text-sm text-muted-foreground">{t('assign.none')}</p>}
                          {mine.map((a) => (
                            <div key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
                              <span className="min-w-52">{label(a.situation)}</span>
                              <Badge variant="outline">{t('assign.progress', { solved: a.solved, target: a.target })}</Badge>
                              <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-destructive"
                                onClick={() => removeAssignment(a.id)}>{t('assign.delete')}</Button>
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Select className="max-w-64" value={form.situation}
                              onChange={(e) => setForm((f) => ({ ...f, situation: e.target.value }))}>
                              {SITUATIONS.map((id) => <option key={id} value={id}>{label(id)}</option>)}
                            </Select>
                            <Input type="number" min="1" max="100" className="w-20" value={form.target}
                              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} />
                            <Button size="sm" onClick={() => assign(s.student_id)}>{t('assign.assignBtn')}</Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('coach.recent')}</h4>
                          {rows === undefined && <p className="text-sm text-muted-foreground">{t('auth.loading')}</p>}
                          {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">{t('coach.noActivity')}</p>}
                          {rows && rows.map((a, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-3 text-sm">
                              {a.conformant
                                ? <Check className="size-4 shrink-0 text-success" />
                                : <X className="size-4 shrink-0 text-destructive" />}
                              <span className="min-w-48 text-muted-foreground">{label(a.deal_id)}</span>
                              <span><Call value={a.your_call} /></span>
                              {!a.conformant && a.expected_call && (
                                <span className="text-muted-foreground">→ <Call value={a.expected_call} /></span>
                              )}
                              <span className="ml-auto text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  )
}
