import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DEALS } from './deals'
import { Call, Hand } from './bridge'
import BiddingBox from './BiddingBox'
import { checkConformance, getBid, explainCall } from '../lib/engine'
import { recordAttempt, fetchStats } from '../lib/attempts'

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

function linkBtn(enabled) {
  return {
    marginTop: 10, padding: '4px 0', fontSize: 15, cursor: enabled ? 'pointer' : 'default',
    background: 'none', border: 'none', color: '#2d6cdf', textDecoration: 'underline',
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
  const [explain, setExplain] = useState(null) // /explain response (student's call)
  const [explaining, setExplaining] = useState(false)
  const [error, setError] = useState(null)
  const [session, setSession] = useState({ correct: 0, total: 0 })
  const [stats, setStats] = useState(null)    // lifetime totals from Supabase

  const deal = DEALS[idx]
  const reqBase = { hand: deal.hand, auction: deal.auction, seat: deal.seat, system_id: 'natural-v1' }
  const describe = (e) => (e.message === 'network' ? t('practice.errNetwork') : e.message)

  useEffect(() => { fetchStats().then(setStats).catch(() => setStats(null)) }, [])

  async function onCheck() {
    if (!selected) return
    setBusy(true); setError(null); setResult(null); setExplain(null)
    try {
      const r = await checkConformance({ ...reqBase, call: selected })
      setResult(r)
      setSession((s) => ({ correct: s.correct + (r.conformant ? 1 : 0), total: s.total + 1 }))
      recordAttempt({
        deal_id: deal.id, hand: deal.hand, auction: deal.auction, seat: deal.seat,
        system_id: 'natural-v1', your_call: selected,
        expected_call: r.expected_call, conformant: r.conformant, situation_id: r.situation_id,
      })
        .then(() => fetchStats().then(setStats).catch(() => {}))
        .catch(() => {})
    } catch (e) {
      setError(describe(e))
    } finally { setBusy(false) }
  }

  async function onWhy() {
    setExplaining(true); setError(null)
    try { setExplain(await explainCall({ auction: deal.auction, call: selected, seat: deal.seat, system_id: 'natural-v1' })) }
    catch (e) { setError(describe(e)) }
    finally { setExplaining(false) }
  }

  async function onShow() {
    setBusy(true); setError(null)
    try { setSys(await getBid(reqBase)) }
    catch (e) { setError(describe(e)) }
    finally { setBusy(false) }
  }

  function onNext() {
    setSelected(null); setResult(null); setSys(null); setExplain(null); setError(null)
    setIdx((i) => (i + 1) % DEALS.length)
  }

  return (
    <section>
      <p style={{ color: '#666', marginBottom: 2 }}>{t('practice.dealCount', { n: idx + 1, total: DEALS.length })}</p>
      <p style={{ color: '#555', marginTop: 0 }}>
        {t('practice.session', { c: session.correct, n: session.total })}
        {stats && <> · {t('practice.lifetime', { solved: stats.solved, total: stats.total })}</>}
      </p>

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
        <BiddingBox value={selected} onSelect={(c) => { setSelected(c); setResult(null); setExplain(null) }} />
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
            <>
              <p style={{ margin: '8px 0 0' }}>{t('practice.expected')}: <Call value={result.expected_call} /></p>
              <p style={{ margin: '8px 0 0', color: '#333' }}>{result.expected_meaning}</p>
              <div>
                <button onClick={onWhy} disabled={explaining} style={linkBtn(!explaining)}>{t('practice.why')}</button>
              </div>
              {explain && (
                <p style={{ margin: '6px 0 0', color: '#333' }}>
                  {t('practice.yourCallMeans')} <Call value={selected} /> — {explain.meaning || t('practice.callUndefined')}
                </p>
              )}
            </>
          )}
          {result.conformant && <p style={{ margin: '8px 0 0', color: '#333' }}>{result.expected_meaning}</p>}
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
