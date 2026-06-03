// Rendering helpers shared by the practice screen. Pure presentation.
const SUIT_SYM = { C: '♣', D: '♦', H: '♥', S: '♠' }
const RED = new Set(['H', 'D'])

function Strain({ s }) {
  if (s === 'NT') return <span>NT</span>
  return <span style={{ color: RED.has(s) ? '#c0392b' : 'inherit' }}>{SUIT_SYM[s]}</span>
}

// Render a single call. Internal formats: 'Pass', 'X', 'XX', '1H', '1NT', '(1S)'…
export function Call({ value }) {
  const v = String(value).trim()
  const paren = v.startsWith('(') && v.endsWith(')')
  const inner = (paren ? v.slice(1, -1) : v).trim()

  let body
  if (inner === 'Pass') body = <>Pass</>
  else if (inner === 'X') body = <>Dbl</>
  else if (inner === 'XX') body = <>Rdbl</>
  else {
    const m = inner.match(/^([1-7])(NT|[CDHS])$/)
    body = m ? <>{m[1]}<Strain s={m[2]} /></> : <>{inner}</>
  }
  if (paren) return <span style={{ opacity: 0.55 }}>(<span>{body}</span>)</span>
  return <span>{body}</span>
}

// Render a 13-card hand from a dotted 'S.H.D.C' holding.
export function Hand({ hand }) {
  const parts = String(hand).toUpperCase().split('.')
  const suits = ['S', 'H', 'D', 'C']
  return (
    <div style={{ display: 'inline-block', fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 24, lineHeight: 1.5, letterSpacing: 2 }}>
      {suits.map((s, i) => {
        const ranks = (parts[i] || '').split('').map((c) => (c === 'T' ? '10' : c))
        return (
          <div key={s} style={{ display: 'flex', gap: 10 }}>
            <span style={{ width: 22, color: RED.has(s) ? '#c0392b' : '#222' }}>{SUIT_SYM[s]}</span>
            <span>{ranks.length ? ranks.join(' ') : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}
