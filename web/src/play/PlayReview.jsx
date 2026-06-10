import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shuffle, Check, X, Play } from 'lucide-react'
import Shell from '../pages/Shell'
import { Hand, SuitGlyph } from '../practice/bridge'
import InteractivePlay from './InteractivePlay'
import { dealBoard, assessRequest, SEATS } from './deal'
import { assessDeal } from '../lib/engine'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STRAINS = ['C', 'D', 'H', 'S', 'NT']
const LEVELS = [1, 2, 3, 4, 5, 6, 7]
const GAME_TRICKS = { NT: 9, S: 10, H: 10, D: 11, C: 11 }

function StrainLabel({ s }) {
  return s === 'NT' ? <span className="font-semibold">NT</span> : <SuitGlyph s={s} />
}

// A compact segmented control.
function Seg({ value, options, onChange, className }) {
  return (
    <div className={cn('inline-flex flex-wrap rounded-lg border border-border bg-muted/40 p-1', className)}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('min-w-9 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SeatCard({ seat, hands, isDeclarer }) {
  const { t } = useTranslation()
  return (
    <Card className={cn(isDeclarer && 'ring-2 ring-primary')}>
      <CardHeader className="flex-row items-center justify-between p-3 pb-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`play.seats.${seat}`)}
        </CardTitle>
        {isDeclarer && <Badge className="text-[10px]">{t('play.declarerTag')}</Badge>}
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <Hand hand={`${hands[seat].S}.${hands[seat].H}.${hands[seat].D}.${hands[seat].C}`} />
      </CardContent>
    </Card>
  )
}

function MakeableGrid({ table }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-72 border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr>
            <th className="w-10" />
            {SEATS.map((s) => (
              <th key={s} className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...STRAINS].reverse().map((st) => (
            <tr key={st}>
              <th className="px-2 text-right text-base"><StrainLabel s={st} /></th>
              {SEATS.map((seat) => {
                const tricks = table?.[seat]?.[st] ?? 0
                const makesGame = tricks >= GAME_TRICKS[st]
                return (
                  <td key={seat}
                    className={cn('rounded-md py-1.5 tabular-nums',
                      tricks < 7 ? 'text-muted-foreground/40'
                        : makesGame ? 'bg-success/15 font-semibold text-success'
                        : 'bg-muted/50 text-foreground')}>
                    {tricks}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">{t('play.gridHint')}</p>
    </div>
  )
}

export default function PlayReview() {
  const { t } = useTranslation()
  const [board, setBoard] = useState(() => dealBoard())
  const [contract, setContract] = useState({ declarer: 'S', level: 4, strain: 'S', doubled: '' })
  const [vul, setVul] = useState('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [playing, setPlaying] = useState(false)

  const set = (patch) => setContract((c) => ({ ...c, ...patch }))

  function newDeal() {
    setBoard(dealBoard()); setResult(null); setError(null)
  }

  async function analyze() {
    setBusy(true); setError(null)
    try {
      setResult(await assessDeal(assessRequest(board.pbn, contract, vul)))
    } catch (e) {
      setError(e.message === 'network' ? t('practice.errNetwork') : e.message)
    } finally { setBusy(false) }
  }

  const dbl = contract.doubled === 'X' ? 'X' : contract.doubled === 'XX' ? 'XX' : ''
  const ContractLabel = () => (
    <span className="inline-flex items-center gap-0.5">
      {contract.level}<StrainLabel s={contract.strain} />{dbl && <span className="text-destructive">{dbl}</span>}
    </span>
  )

  if (playing) {
    return (
      <Shell>
        <InteractivePlay board={board} contract={contract} onExit={() => setPlaying(false)} />
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('play.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('play.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={newDeal}><Shuffle /> {t('play.newDeal')}</Button>
        </div>

        {/* Compass table */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="md:col-start-2 md:row-start-1"><SeatCard seat="N" hands={board.hands} isDeclarer={contract.declarer === 'N'} /></div>
          <div className="md:col-start-1 md:row-start-2"><SeatCard seat="W" hands={board.hands} isDeclarer={contract.declarer === 'W'} /></div>
          <div className="hidden place-items-center md:col-start-2 md:row-start-2 md:grid">
            <div className="text-center">
              <div className="text-3xl font-bold"><ContractLabel /></div>
              <div className="text-xs text-muted-foreground">{t('play.byShort', { seat: contract.declarer })}</div>
            </div>
          </div>
          <div className="md:col-start-3 md:row-start-2"><SeatCard seat="E" hands={board.hands} isDeclarer={contract.declarer === 'E'} /></div>
          <div className="md:col-start-2 md:row-start-3"><SeatCard seat="S" hands={board.hands} isDeclarer={contract.declarer === 'S'} /></div>
        </div>

        {/* Contract picker */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t('play.contract')}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">{t('play.declarer')}</div>
              <Seg value={contract.declarer} onChange={(v) => set({ declarer: v })}
                options={SEATS.map((s) => ({ value: s, label: s }))} />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">{t('play.level')}</div>
              <Seg value={contract.level} onChange={(v) => set({ level: v })}
                options={LEVELS.map((l) => ({ value: l, label: l }))} />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">{t('play.strain')}</div>
              <Seg value={contract.strain} onChange={(v) => set({ strain: v })}
                options={STRAINS.map((s) => ({ value: s, label: <StrainLabel s={s} /> }))} />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">{t('play.doubled')}</div>
              <Seg value={contract.doubled} onChange={(v) => set({ doubled: v })}
                options={[{ value: '', label: t('play.none') }, { value: 'X', label: 'X' }, { value: 'XX', label: 'XX' }]} />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">{t('play.vul')}</div>
              <Seg value={vul} onChange={setVul}
                options={[
                  { value: 'none', label: t('play.vulNone') }, { value: 'ns', label: t('play.vulNS') },
                  { value: 'ew', label: t('play.vulEW') }, { value: 'both', label: t('play.vulBoth') },
                ]} />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setPlaying(true)}><Play /> {t('play.playHand')}</Button>
              <Button onClick={analyze} disabled={busy}>{busy ? t('play.analyzing') : t('play.analyze')}</Button>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{t('practice.error')}: {error}</p>}

        {result && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className={cn('border-2', result.makes ? 'border-success/50 bg-success/5' : 'border-destructive/40 bg-destructive/5')}>
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-center gap-2 text-2xl font-bold">
                  {result.makes ? <Check className="size-6 text-success" /> : <X className="size-6 text-destructive" />}
                  <ContractLabel />
                  <span className="text-base font-normal text-muted-foreground">{t('play.byShort', { seat: result.declarer })}</span>
                </div>
                <p className={cn('text-sm font-medium', result.makes ? 'text-success' : 'text-destructive')}>
                  {result.makes
                    ? t('play.makesBy', { n: result.result === 0 ? '=' : `+${result.result}` })
                    : t('play.downBy', { n: -result.result })}
                  {' · '}{t('play.tricks', { n: result.tricks_made })}
                </p>
                <p className="text-sm text-muted-foreground">{t('play.par')}: <span className="font-medium text-foreground">{result.optimal_result}</span></p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t('play.makeable')}</CardTitle></CardHeader>
              <CardContent><MakeableGrid table={result.makeable_contracts} /></CardContent>
            </Card>
          </div>
        )}
      </div>
    </Shell>
  )
}
