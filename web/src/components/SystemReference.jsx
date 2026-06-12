import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSystem } from '../lib/engine'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Read-only reference for the active bidding system's coach-amendable settings.
// The engine doesn't apply these toggles at runtime yet; this surfaces what the
// system grades against (and is the natural home for editing them later).
export default function SystemReference({ systemId = 'natural-v1' }) {
  const { t } = useTranslation()
  const [sys, setSys] = useState(null)

  useEffect(() => {
    let cancel = false
    getSystem(systemId).then((s) => { if (!cancel) setSys(s) }).catch(() => {})
    return () => { cancel = true }
  }, [systemId])

  if (!sys) return null
  const g = sys.toggles || {}
  const range = (r) => (r ? `${r.min}-${r.max}` : '—')
  const rows = [
    [t('system.openMin'), g.open_min_hcp != null ? `${g.open_min_hcp}+` : '—'],
    [t('system.nt'), range(g.nt_range)],
    [t('system.nt2'), range(g.nt2_range)],
    [t('system.strong2c'), g.strong_2c ? `${g.strong_2c.min}+` : '—'],
    [t('system.weak2'), range(g.weak2_range)],
    [t('system.ntMajor'), g.nt_with_5card_major ? t('system.yes') : t('system.no')],
  ]

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold tracking-tight">{t('system.title')}</h3>
          <Badge variant="secondary">{sys.name}</Badge>
          <span className="text-xs text-muted-foreground">
            {t('system.counts', { situations: sys.situations, rules: sys.rules })}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">{t('system.readonly')}</p>
      </CardContent>
    </Card>
  )
}
