import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Shell from './Shell'
import BidPractice from '../practice/BidPractice'
import { fetchStudentAssignments } from '../lib/assignments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
      <div className="space-y-6">
        {assignments.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{t('assign.fromCoach')}</CardTitle></CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {assignments.map((a) => {
                const active = filter === a.situation
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="font-medium">{label(a.situation)}</span>
                    <Badge variant="secondary">{t('assign.progress', { solved: a.solved, target: a.target })}</Badge>
                    <Button size="sm" variant={active ? 'default' : 'outline'} className="ml-auto"
                      onClick={() => setFilter(active ? null : a.situation)}>
                      {active ? t('assign.practicing') : t('assign.practice')}
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {filter && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('assign.focused', { name: label(filter) })}</span>
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1" onClick={() => setFilter(null)}>
              <X /> {t('assign.clearFocus')}
            </Button>
          </div>
        )}

        <BidPractice only={filter} />
      </div>
    </Shell>
  )
}
