import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEALS } from './deals'
import { Call, Hand } from './bridge'
import BiddingBox from './BiddingBox'
import { checkConformance, getBid } from '../lib/engine'

function Auction({ auction }) {
  const { t } = useTranslation()
  if (!auction.length) return <em>{t('practice.youOpen')}</em>
  return (
    <span style={{ fontSize: 20 }}>
      {auction.map((c, i) => (
        <span key={i} style={{ marginRight: 12 }}><Call value={c} /></span>
      ))}
      <span style={{ fontWeight: 700 }}>?</span>
    </span>
  )
}

function btn(enabled) {
  return {
    padding: '10px 18px', fontSize: 16, borderRadius: 6,
    cursor: enabled ? 'pointer' : 'default',
    border: '1px solid #888', background: enabled ? '#fff' : '#f0f0f0',
    opacity: enabled ? 1 : 0.6,
  }
}

function card(ok) {
  const border = ok === true ? '#2e7d32' : ok === false ? '#c0392b' : '#bbb'
  const bg = ok === true ? '#edf7ed' : ok === false ? '#fdecea' : '#f7f7f7'
  return { border: `1px solid ${border}`, background: bg, borderRadius: 8, padding: '12px 16px', margin: '12px 0' }
}

export default function BidPractice() {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // /conformance response
  const [sys, setSys] = useState(null)        // /bid response
  const [error, setError] = useState(null)

  const deal = DEALS[idx]
  const reqBase = { hand: deal.hand, auction: deal.auction, seat: deal.seat, system_id: 'natural-v1' }

  const describe = (e) => (e.message === 'network' ? t('practice.errNetwork') : e.message)

  async function onCheck() {
    if (!selected) return
    setBusy(true); setError(null); setResult(null)
    try { setResult(await checkConformance({ ...reqBase, call: selected })) }
    catch (e) { setError(describe(e)) }
    finally { setBusy(false) }
  }

  async function onShow() {
    setBusy(true); setError(null)
    try { setSys(await getBid(reqBase)) }
    catch (e) { setError(describe(e)) }
    finally { setBusy(false) }
  }

  function onNext() {
    setSelected(null); setResult(null); setSys(null); setError(null)
    setIdx((i) => (i + 1) % DEALS.length)
  }

  return (
    <section>
      <p style={{ color: '#666' }}>{t('practice.dealCount', { n: idx + 1, total: DEALS.length })}</p>

      <div style={{ margin: '16px 0' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('practice.yourHand')}</div>
        <Hand hand={deal.hand} />
      </div>

      <div style={{ margin: '16px 0' }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('practice.auction')}</div>
        <Auction auction={deal.auction} />
      </div>

      <div style={{ margin: '16px 0' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('practice.yourCall')}</div>
        <BiddingBox value={selected} onSelect={(c) => { setSelected(c); setResult(null) }} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <button onClick={onCheck} disabled={!selected || busy} style={btn(!!selected && !busy)}>{t('practice.check')}</button>
        <button onClick={onShow} disabled={busy} style={btn(!busy)}>{t('practice.showAnswer')}</button>
        <button onClick={onNext} disabled={busy} style={btn(!busy)}>{t('practice.next')}</button>
      </div>

      {error && <p style={{ color: '#c0392b' }}>{t('practice.error')}: {error}</p>}

      {result && (
        <div style={card(result.conformant)}>
          <strong style={{ fontSize: 18 }}>{result.conformant ? t('practice.correct') : t('practice.incorrect')}</strong>
          {!result.conformant && (
            <p style={{ margin: '8px 0 0' }}>{t('practice.expected')}: <Call value={result.expected_call} /></p>
          )}
          <p style={{ margin: '8px 0 0', color: '#333' }}>{result.expected_meaning}</p>
        </div>
      )}

      {sys && (
        <div style={card(null)}>
          <p style={{ margin: 0 }}><strong>{t('practice.systemBids')}:</strong> <Call value={sys.call} /></p>
          <p style={{ margin: '8px 0 0', color: '#333' }}>{sys.meaning}</p>
        </div>
      )}
    </section>
  )
}
