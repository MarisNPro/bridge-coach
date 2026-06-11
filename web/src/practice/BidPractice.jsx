import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, Eye, RotateCcw, HelpCircle } from 'lucide-react'
import { nextProblem } from './generate'
import { Call, Hand } from './bridge'
import BiddingBox from './BiddingBox'
import { checkConformance, getBid, explainCall } from '../lib/engine'
import { recordAttempt, fetchStats } from '../lib/attempts'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function Auction({ auction }) {
  const { t } = useTranslation()
  if (!auction.length) return <p className="italic text-muted-foreground">{t('practice.youOpen')}</p>
  return (
    <div className="flex flex-wrap items-center gap-2 text-lg">
      {auction.map((c, i) => (
        <span key={i} className="rounded-md bg-muted px-2 py-1"><Call value={c} /></span>
      ))}
      <span className="text-xl font-bold text-primary">?</span>
    </div>
  )
}

function SectionTitle({ children }) {
  return <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{children}</CardTitle>
}

export default function BidPractice({ only = null }) {
  const { t } = useTranslation()
  const { feedback } = useSettings()
  const [problem, setProblem] = useState(() => nextProblem(only))
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // /conformance response
  const [sys, setSys] = useState(null)        // /bid response
  const [explain, setExplain] = useState(null) // /explain response (student's call)
  const [explaining, setExplaining] = useState(false)
  const [error, setError] = useState(null)
  const [session, setSession] = useState({ correct: 0, total: 0 })
  const [stats, setStats] = useState(null)    // lifetime totals from Supabase

  const deal = problem
  const reqBase = { hand: deal.hand, auction: deal.auction, seat: deal.seat, system_id: 'natural-v1' }
  const describe = (e) => (e.message === 'network' ? t('practice.errNetwork') : e.message)

  useEffect(() => { fetchStats().then(setStats).catch(() => setStats(null)) }, [])

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setSelected(null); setResult(null); setSys(null); setExplain(null); setError(null)
    setProblem(nextProblem(only))
  }, [only])

  async function onWhy() {
    setExplaining(true); setError(null)
    try { setExplain(await explainCall({ auction: deal.auction, call: selected, seat: deal.seat, system_id: 'natural-v1' })) }
    catch (e) { setError(describe(e)) }
    finally { setExplaining(false) }
  }

  // Detailed feedback auto-explains the student's own (wrong) call.
  useEffect(() => {
    if (result && !result.conformant && feedback === 'detailed' && !explain && !explaining) onWhy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  async function onCheck() {
    if (!selected) return
    setBusy(true); setError(null); setResult(null); setExplain(null)
    try {
      const r = await checkConformance({ ...reqBase, call: selected })
      setResult(r)
      setSession((s) => ({ correct: s.correct + (r.conformant ? 1 : 0), total: s.total + 1 }))
      recordAttempt({
        deal_id: r.situation_id || deal.id, hand: deal.hand, auction: deal.auction, seat: deal.seat,
        system_id: 'natural-v1', your_call: selected,
        expected_call: r.expected_call, conformant: r.conformant, situation_id: r.situation_id,
      })
        .then(() => fetchStats().then(setStats).catch(() => {}))
        .catch(() => {})
    } catch (e) {
      setError(describe(e))
    } finally { setBusy(false) }
  }

  async function onShow() {
    setBusy(true); setError(null)
    try { setSys(await getBid(reqBase)) }
    catch (e) { setError(describe(e)) }
    finally { setBusy(false) }
  }

  function onNext() {
    setSelected(null); setResult(null); setSys(null); setExplain(null); setError(null)
    setProblem(nextProblem(only))
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('practice.problemNo', { n: problem.n })}</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{t('practice.session', { c: session.correct, n: session.total })}</Badge>
          {stats && <Badge variant="outline">{t('practice.lifetime', { solved: stats.solved, total: stats.total })}</Badge>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><SectionTitle>{t('practice.yourHand')}</SectionTitle></CardHeader>
          <CardContent className="space-y-5">
            <Hand hand={deal.hand} />
            <div>
              <div className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('practice.auction')}</div>
              <Auction auction={deal.auction} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><SectionTitle>{t('practice.yourCall')}</SectionTitle></CardHeader>
          <CardContent className="space-y-5">
            <BiddingBox value={selected} onSelect={(c) => { setSelected(c); setResult(null); setExplain(null) }} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onCheck} disabled={!selected || busy}><Check /> {t('practice.check')}</Button>
              <Button variant="outline" onClick={onShow} disabled={busy}><Eye /> {t('practice.showAnswer')}</Button>
              <Button variant="ghost" onClick={onNext} disabled={busy}><RotateCcw /> {t('practice.next')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{t('practice.error')}: {error}</p>}

      {result && (
        <Card className={cn('border-2', result.conformant ? 'border-success/50 bg-success/5' : 'border-destructive/40 bg-destructive/5')}>
          <CardContent className="space-y-2 pt-5">
            <div className="flex items-center gap-2 text-lg font-semibold">
              {result.conformant ? <Check className="text-success" /> : <X className="text-destructive" />}
              <span className={result.conformant ? 'text-success' : 'text-destructive'}>
                {result.conformant ? t('practice.correct') : t('practice.incorrect')}
              </span>
            </div>
            {result.conformant && feedback !== 'minimal' && (
              <p className="text-sm text-foreground/80">{result.expected_meaning}</p>
            )}
            {!result.conformant && (
              <>
                <p className="text-sm">{t('practice.expected')}: <span className="font-medium"><Call value={result.expected_call} /></span></p>
                {feedback !== 'minimal' && <p className="text-sm text-foreground/80">{result.expected_meaning}</p>}
                {feedback !== 'minimal' && (
                  <Button variant="link" className="h-auto p-0" onClick={onWhy} disabled={explaining}>
                    <HelpCircle /> {t('practice.why')}
                  </Button>
                )}
                {explain && (
                  explain.variants && explain.variants.length > 1 ? (
                    <div className="text-sm text-foreground/80">
                      <span>{t('practice.yourCallMeans')} <Call value={selected} />:</span>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {explain.variants.map((v, i) => <li key={i}>{v.meaning}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/80">
                      {t('practice.yourCallMeans')} <Call value={selected} /> — {explain.meaning || t('practice.callUndefined')}
                    </p>
                  )
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {sys && (
        <Card className="border-2 border-primary/40 bg-primary/5">
          <CardContent className="space-y-1 pt-5">
            <p className="font-medium">{t('practice.systemBids')}: <Call value={sys.call} /></p>
            <p className="text-sm text-foreground/80">{sys.meaning}</p>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
