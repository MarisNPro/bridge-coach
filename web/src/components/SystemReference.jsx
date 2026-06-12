import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSystem } from '../lib/engine'
import { useSettings } from '@/lib/settings'
import { WEAK2_KEYS, weak2Range } from '@/lib/toggles'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'

// Reference for the active bidding system's settings. Most are read-only; the
// weak-two range is a live toggle (applied by the engine) chosen via a preset.
export default function SystemReference({ systemId = 'natural-v1' }) {
  const { t } = useTranslation()
  const { weak2, set } = useSettings()
  const [sys, setSys] = useState(null)

  useEffect(() => {
    let cancel = false
    getSystem(systemId).then((s) => { if (!cancel) setSys(s) }).catch(() => {})
    return () => { cancel = true }
  }, [systemId])

  if (!sys) return null
  const g = sys.toggles || {}
  const range = (r) => (r ? `${r.min}-${r.max}` : '—')
  const w2 = weak2Range(weak2)
  const rows = [
    [t('system.openMin'), g.open_min_hcp != null ? `${g.open_min_hcp}+` : '—'],
    [t('system.nt'), range(g.nt_range)],
    [t('system.nt2'), range(g.nt2_range)],
    [t('system.strong2c'), g.strong_2c ? `${g.strong_2c.min}+` : '—'],
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
        {/* Editable, engine-applied toggle. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
          <span className="text-sm text-muted-foreground">{t('system.weak2')}</span>
          <Select className="max-w-48" value={weak2} onChange={(e) => set({ weak2: e.target.value })}>
            {WEAK2_KEYS.map((k) => <option key={k} value={k}>{t(`system.w2.${k}`)}</option>)}
          </Select>
          <Badge variant="outline" className="tabular-nums">{w2.min}-{w2.max}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{t('system.weak2Note')}</p>
      </CardContent>
    </Card>
  )
}
