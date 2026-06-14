# Card-play UX redesign — research + plan

Replace the card-play surface ([web/src/play/InteractivePlay.jsx](../web/src/play/InteractivePlay.jsx))
with a modern, **mobile-first** table. Pure presentation/interaction rewrite — the
engine wiring (`/play`, `/bot`), game logic, and surrounding screens stay as-is.

_Decisions locked with the product owner (2026-06-14):_
1. **Card visuals are user-switchable** — a "Minimalist" deck (today's clean
   rank+suit style, enlarged into real card faces) **and** an "Illustrative"
   deck (full playing-card faces, indices + pips/court art, card backs).
2. **Two layouts** — a new phone-portrait table is the priority; the existing
   4-around compass is preserved on wide (tablet/desktop) screens.

---

## 1. Research — how modern bridge apps handle card play

Surveyed BBO, Funbridge, Tricky Bridge, Trickster Cards, Bridge by NeuralPlay,
plus general mobile card-game / card-UI guidance.

**The universal portrait convention ("you-at-the-bottom"):**
- The human's hand is the hero element, **anchored along the bottom edge**,
  rendered as a horizontally **overlapping fan** of large card faces.
- **Dummy** sits across the **top**, face-up (revealed after the opening lead),
  usually slightly smaller / suit-grouped.
- **Opponents (LHO/RHO)** are **card-backs** on the **left and right edges**,
  shown only as a fanned count — you never see their faces until the deal ends.
- A **central trick "well"** shows the four played cards positioned toward the
  seat that played them (N=top, E=right, S=bottom, W=left), with the winning
  card highlighted briefly before the trick clears.
- Orientation is **relative to the user**, not absolute compass — whatever seat
  you control is drawn at the bottom and labelled "You".

**Interaction:**
- **Tap-to-play is the standard**, not drag. Bridge has exactly one legal-ish
  action per turn and small targets; tapping is faster and more reliable on
  phones than drag, and far more accessible. (Funbridge/BBO/Tricky are all tap.)
  Optional refinement: "tap to select, tap again to confirm" for shaky hands —
  we can gate this behind a setting later, but default to single-tap.
- **Only legal cards are tappable**; illegal cards dim. The current code already
  computes `legalSet` — we keep that.
- A **hint** raises/outlines the double-dummy best card(s) — we keep today's
  `bestSet` behaviour, just restyled on the fan.

**Visual / accessibility guidance that shapes this:**
- Touch targets **≥ 44×44 px**; in an overlapping fan, the exposed strip of each
  card must stay ≥ ~36–44 px wide, and the **tapped/active card lifts** clear of
  its neighbours.
- Suit colour contrast matters (one cited app's clubs/diamonds were "barely
  legible") — our 4-colour deck tokens already address this; keep them.
- Respect `prefers-reduced-motion` (already honoured for `card-in`).
- Keep the older-audience accessibility posture already in the app (16/18px base,
  large-text setting).

**Sources:**
- [7 Best Bridge Apps — MPL Games](https://www.mplgames.com/blog/best-bridge-apps/)
- [Tricky Bridge](https://www.trickybridge.com/)
- [Great Bridge Links — Contract Bridge Apps](https://greatbridgelinks.com/gblsoft/itunes-android-apps/)
- [Card UI best practices — UX Collective](https://uxdesign.cc/8-best-practices-for-ui-card-design-898f45bb60cc)
- [Drag-and-drop UX guidelines — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/)
- [Game UI/UX best practices — UX Planet](https://uxplanet.org/game-design-ux-best-practices-guide-4a3078c32099)
- [BBO redesign news](https://news.bridgebase.com/2025/09/30/redesigned-tournament-list/)

---

## 2. What's wrong with the current card-play UX on mobile

Reading [InteractivePlay.jsx](../web/src/play/InteractivePlay.jsx):

- **Abstract compass grid, even on phones.** `grid-cols-2 ... md:grid-cols-3`
  drops the four hands into a cramped 2×2 on phones; there is no "you at the
  bottom" anchoring and the trick well lands in an awkward cell.
- **Cards aren't cards.** Each holding is suit-rows of small mono-text buttons
  (`h-9 min-w-7`) — functional, but nothing like the card faces players expect,
  and the tap targets are below the 44px comfort line for an older audience.
- **Toolbar overload.** 6+ ghost buttons (undo, claim, mode, reveal, hint, exit)
  in a `flex-wrap` row that wraps badly and competes with the table for height —
  the worst offender on a phone.
- **Tiny trick chips.** The played cards are 3×3-grid bordered chips in the
  centre cell; hard to read, no sense of "who played what."
- **All four hands always rendered** the same way; opponents as face-down
  pill-stacks rather than edge card-backs.

The game logic underneath is sound — this is a **shell/layout problem**.

---

## 3. Target design

### Phone (portrait) — the priority
```
┌─────────────────────────────┐
│ 4♠ by S   Decl 7/10  DD +1  │  ← slim status bar (contract · tricks · live DD)
├─────────────────────────────┤
│            [N dummy]         │  ← dummy across the top (face-up after lead),
│                              │     suit-grouped, compact
│  [W]      ┌───────┐     [E]  │  ← LHO / RHO = edge card-backs (fanned count)
│  backs    │ trick │   backs  │
│           │  well │          │  ← central well: cards toward their seat,
│           └───────┘          │     winner highlighted, then clears
│                              │
│   ♠ A K Q J  ♥ 10 9 …        │  ← YOUR hand: large overlapping fan,
│   [== overlapping fan ==]    │     anchored bottom, legal cards lifted/lit
├─────────────────────────────┤
│  ⤺ Undo   ⚐ Claim   ⋯ More   │  ← compact action bar; secondary actions in ⋯
└─────────────────────────────┘
```
- **Relative seating:** the seat(s) the user controls render at the bottom as
  "You"; partner/dummy top; opponents the sides. Declaring (you play declarer +
  dummy) shows dummy at top face-up and your hand at bottom; defending shows your
  hand at bottom and dummy wherever it sits relative to you.
- **Overlapping fan** for the active hand; cards grouped by suit with 4-colour
  tokens; **active card lifts** above the fan; illegal cards dimmed and inert.
- **Action bar** keeps only the live actions (Undo, Claim when legal); Reveal,
  Hint, Defend/Declare mode, and Exit move into a **"More" sheet** (Radix dialog
  / bottom sheet — `@radix-ui/react-dialog` is already a dependency).
- **Status bar** condenses today's badges: contract, declarer tricks made/needed,
  defenders, and the live DD projection.

### Tablet / desktop — keep the compass
- Preserve the existing 4-around compass grid (`md:grid-cols-3`) — it reads well
  with the room to breathe. It shares the **same card components and the same
  state hook** as the phone layout, so there's one source of truth; only the
  arrangement differs, switched on a Tailwind breakpoint.

### Deck-style setting (minimalist ↔ illustrative)
- Add `cardStyle: 'minimalist' | 'illustrative'` to
  [lib/settings.jsx](../web/src/lib/settings.jsx) `DEFAULTS` and a control in
  [components/SettingsDialog.jsx](../web/src/components/SettingsDialog.jsx),
  alongside the existing `deck` (4/2-colour) toggle.
- A single `<PlayingCard>` component reads the setting:
  - **minimalist** — today's rank + `SuitGlyph`, enlarged onto a proper card
    face (rounded, bordered, corner index). Reuses existing tokens; no assets.
  - **illustrative** — full face: corner indices both ends, suit pips / simple
    court motifs, and a themed **card back** for opponents. Drawn as inline SVG
    (crisp, themeable, light bundle — no image set to ship).
- Both honour the 4-colour/2-colour `deck` setting and dark mode.

---

## 4. Implementation plan (incremental PRs, matching repo style)

State, engine calls, bot orchestration, undo/claim/hidden logic from
`InteractivePlay` are **reused unchanged**; we lift the rendering into new
components and add a layout switch.

**PR-1 — Card primitives + deck setting**
- New `web/src/play/cards/PlayingCard.jsx` (`minimalist` | `illustrative`,
  4/2-colour aware, dark-mode aware) and `CardBack.jsx`.
- New `Fan.jsx` (overlapping, suit-grouped, lift-on-active, ≥44px exposed strip,
  legal/illegal/best states; tap → `onPlay`).
- Add `cardStyle` to settings + Settings dialog control.
- Tests: `PlayingCard` renders rank/suit per style & colour; `Fan` only fires
  `onPlay` for legal cards and marks `best`. Storybook-free, RTL like existing.

**PR-2 — Mobile table shell**
- New `web/src/play/MobileTable.jsx`: status bar, dummy-top, edge card-backs,
  central trick well, bottom fan, compact action bar + "More" bottom sheet.
- Relative-seat mapping helper (`userSeat` → bottom) with a unit test.
- Pure presentation: takes the same props the compass cells get today.

**PR-3 — Wire `InteractivePlay` to both layouts**
- Extract the game-state logic from `InteractivePlay` into a `usePlay()` hook
  (engine fetch effect, bot/auto-play effect, `onPlay`/`undo`/claim, derived
  `legalSet`/`bestSet`/projection). No behaviour change — covered by the
  existing [InteractivePlay.test.jsx](../web/src/play/InteractivePlay.test.jsx).
- `InteractivePlay` renders `<MobileTable>` by default and the existing compass
  on `md+` (CSS-driven; render both, hide one — or a `matchMedia` switch).
- Keep all existing i18n keys; add the few new ones (`More`, `cardStyle`, deck
  labels) to `en.json` + `lv.json`.

**PR-4 — Polish + a11y pass**
- Card-play animations (deal-in for the fan, winner glow, trick-clear) gated on
  `prefers-reduced-motion`.
- Touch-target audit (≥44px), focus-visible rings, screen-reader labels on cards
  (`aria-label="Ace of spades"`), and keyboard play (arrow to move along the fan,
  Enter/Space to play) for parity with the bidding box.
- Manual pass on a real phone viewport; verify dark + 2-colour + large-text combos.

Each PR is independently shippable and leaves the app working.

---

## 5. Risks / open questions
- **Illustrative court art** scope — keep it simple (J/Q/K as a letter + a small
  motif, not full face cards) to avoid an asset/bundle blow-up; revisit if the
  product owner wants richer art.
- **`usePlay()` extraction** is the one behavioural-risk step — the existing
  test suite is the safety net; do it as a no-op refactor first, redesign second.
- **Two layouts** means two arrangements but **one** card/fan/well/state core —
  guard against logic drifting between them by keeping all of it in `usePlay()`.
