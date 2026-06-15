import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { playPosition, playBot } from '../lib/engine'
import { trickWinner, projectedDeclarerTricks } from './deal'

const SUITS = ['S', 'H', 'D', 'C']
const PARTNER = { N: 'S', S: 'N', E: 'W', W: 'E' }
const LHO = { N: 'E', E: 'S', S: 'W', W: 'N' }   // left-hand opponent (clockwise)

export function handCards(h) {
  return SUITS.flatMap((s) => [...(h[s] || '')].map((r) => s + r))
}

// All play state, the engine orchestration, and the derived view of one deal —
// shared verbatim by the compass (wide) and mobile layouts. Behaviour mirrors
// the original InteractivePlay; the two layouts only differ in presentation.
export function usePlay({ board, contract, constraints = null, userSeat = null }) {
  const { t } = useTranslation()
  const [plays, setPlays] = useState([])
  const [eng, setEng] = useState(null)
  const [hint, setHint] = useState(true)
  const [claimed, setClaimed] = useState(false)
  const [hidden, setHidden] = useState(true)   // hidden-hand mode: opponents face-down
  const [defend, setDefend] = useState(false)  // play as a defender vs a bot declarer
  const [error, setError] = useState(null)

  const dummySeat = PARTNER[contract.declarer]
  const leader = LHO[contract.declarer]        // opening leader = declarer's LHO
  // Declare: you play declarer + dummy. Defend: you play the opening leader; the
  // bot plays the whole declaring side and your partner. When `userSeat` is fixed
  // (from the bidding phase), the auction decides: you declare if your side won
  // the contract, otherwise you defend as that seat.
  const onDeclaringSide = userSeat && (userSeat === contract.declarer || userSeat === dummySeat)
  const userSeats = userSeat
    ? (onDeclaringSide ? [contract.declarer, dummySeat] : [userSeat])
    : (defend ? [leader] : [contract.declarer, dummySeat])
  const need = contract.level + 6
  const dottedHand = (h) => `${h.S || ''}.${h.H || ''}.${h.D || ''}.${h.C || ''}`

  function switchMode() { setDefend((d) => !d); setPlays([]); setClaimed(false) }

  // What a bot may see when it's its turn. The declaring side (declarer + dummy)
  // sees both of its hands; a defender sees only its own hand + dummy once the
  // opening lead is down. The concealed hands are never included.
  function botKnownHands(seat) {
    const known = {}
    const openingLed = plays.length >= 1
    if (seat === contract.declarer || seat === dummySeat) {
      known[contract.declarer] = dottedHand(board.hands[contract.declarer])
      known[dummySeat] = dottedHand(board.hands[dummySeat])
    } else {
      known[seat] = dottedHand(board.hands[seat])
      if (openingLed) known[dummySeat] = dottedHand(board.hands[dummySeat])
    }
    return known
  }

  // Fetch the engine state whenever the play history changes.
  useEffect(() => {
    let cancel = false
    setError(null)
    playPosition({ deal: board.pbn, strain: contract.strain, declarer: contract.declarer, played: plays.map((p) => p.card) })
      .then((r) => { if (!cancel) setEng(r) })
      .catch((e) => { if (!cancel) setError(e.message === 'network' ? t('practice.errNetwork') : e.message) })
    return () => { cancel = true }
  }, [plays, board.pbn, contract.strain, contract.declarer, t])

  // Drive the seats the user doesn't control. On a claim, resolve the whole hand
  // double-dummy (best card for every seat). Otherwise an opponent's turn is
  // played by the non-cheating bot (/bot), which sees only its hand + dummy.
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!eng || eng.complete) return
    if (!claimed && userSeats.includes(eng.to_act)) return
    const seat = eng.to_act
    const bestDD = () => eng.legal.reduce((a, b) => (b.dd > a.dd ? b : a), eng.legal[0]).card

    if (claimed) {
      timer.current = setTimeout(() => setPlays((ps) => [...ps, { seat, card: bestDD() }]), 250)
      return () => clearTimeout(timer.current)
    }

    let cancelled = false
    timer.current = setTimeout(() => {
      playBot({
        known_hands: botKnownHands(seat), played: plays.map((p) => p.card),
        strain: contract.strain, declarer: contract.declarer, samples: 16, constraints,
      })
        .then((r) => { if (!cancelled) setPlays((ps) => [...ps, { seat, card: r.card }]) })
        .catch(() => { if (!cancelled) setPlays((ps) => [...ps, { seat, card: bestDD() }]) }) // fall back to DD
    }, 450)
    return () => { cancelled = true; clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng, claimed])

  function onPlay(card) {
    if (claimed || !eng || eng.complete || !userSeats.includes(eng.to_act)) return
    if (!eng.legal.some((l) => l.card === card)) return
    setPlays((ps) => [...ps, { seat: eng.to_act, card }])
  }

  // Take back to our last decision: drop our last card and any defender
  // responses to it, so it's our turn again. Only offered on our turn (no
  // pending auto-play), which keeps it race-free.
  function undo() {
    setPlays((ps) => {
      let i = ps.length - 1
      while (i >= 0 && !userSeats.includes(ps[i].seat)) i--
      return i < 0 ? ps : ps.slice(0, i)
    })
  }

  const playedBySeat = { N: new Set(), E: new Set(), S: new Set(), W: new Set() }
  plays.forEach((p) => playedBySeat[p.seat].add(p.card))
  const remaining = (seat) => handCards(board.hands[seat]).filter((c) => !playedBySeat[seat].has(c))

  const legalSet = new Set((eng?.legal || []).map((l) => l.card))
  const bestSet = new Set()
  if (hint && eng && !eng.complete && userSeats.includes(eng.to_act) && eng.legal.length) {
    const top = Math.max(...eng.legal.map((l) => l.dd))
    eng.legal.filter((l) => l.dd === top).forEach((l) => bestSet.add(l.card))
  }

  const made = eng?.declarer_tricks ?? 0
  const complete = !!eng?.complete
  const makes = complete && made >= need
  const delta = made - need
  // Live double-dummy projection of the final result from the current position.
  const projected = projectedDeclarerTricks(eng, userSeats)
  const projDelta = projected - need
  const isUserTurn = eng && !eng.complete && userSeats.includes(eng.to_act)
  const canUndo = isUserTurn && !claimed && plays.some((p) => userSeats.includes(p.seat))
  const canClaim = isUserTurn && !claimed && !defend   // claiming is a declarer action

  // The most recent completed trick (tricks are consecutive groups of 4 plays).
  const completedTricks = Math.floor(plays.length / 4)
  const lastTrick = completedTricks > 0 ? plays.slice((completedTricks - 1) * 4, completedTricks * 4) : null

  // Trick shown in the centre: the in-progress trick (1-3 cards), or — once the
  // 4th card lands — the just-completed trick held with its winner highlighted,
  // until the next card leads the following trick.
  const building = plays.slice(completedTricks * 4)
  const justCompleted = building.length === 0 && completedTricks > 0
    ? plays.slice((completedTricks - 1) * 4, completedTricks * 4) : null
  const shownTrick = building.length > 0 ? building : (justCompleted || [])
  const winnerSeat = shownTrick.length === 4 ? trickWinner(shownTrick, contract.strain) : null
  const trickBySeat = {}
  shownTrick.forEach((p) => { trickBySeat[p.seat] = p.card })

  // Hidden-hand view: you see the seats you control always, dummy once the
  // opening lead is made, and everything at the end for review; the rest are
  // face-down.
  const revealAll = !hidden || eng?.complete
  const isVisible = (seat) =>
    revealAll || userSeats.includes(seat) || (seat === dummySeat && plays.length >= 1)

  return {
    // raw
    plays, eng, error, hint, hidden, defend, claimed,
    // seating
    dummySeat, leader, userSeats, need,
    // derived per-seat
    remaining, isVisible, legalSet, bestSet,
    // status
    made, complete, makes, delta, projDelta, isUserTurn,
    defenderTricks: eng?.defender_tricks ?? 0,
    // trick
    trickBySeat, winnerSeat, lastTrick, building,
    // actions
    onPlay, undo, claim: () => setClaimed(true), switchMode,
    toggleHint: () => setHint((h) => !h),
    toggleReveal: () => setHidden((h) => !h),
    canUndo, canClaim,
    showModeToggle: !userSeat,
  }
}
