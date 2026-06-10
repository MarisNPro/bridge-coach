# Bridge Coach — Code Review Notes

_Deep-dive review of the codebase as of 2026-06-10 (bidding system complete + double-dummy
play + full UI redesign). Companion to [`user-stories.md`](./user-stories.md)._

This is an honest assessment: what's strong, what's worth tidying, and a few things to
watch. Nothing here is a blocker — the product is coherent, deployed, and verified end-to-end.
**Engine** is live on Railway (`/health`, `/bid`, `/conformance`, `/explain`, `/assess`, `/play`
all 200); **web** is live on Vercel; CORS is locked to the web origin.

**Since the 2026-06-09 baseline (largest changes):**
- **Bidding system completed** — engine test layer (HTTP-boundary + a coverage vetter), the
  `resp-1c/1d/1nt` gaps closed, the **complete opener-rebid tree** (1-over-1, 1NT response,
  major raise, 2/1), and the **negative-double matrix** (responder after every simple 1- and
  2-level suit overcall). 28 → **56 situations**, ~200 → **410 rules**; pool 11 → **43**.
- **Double-dummy play** — `/assess` (contract result, par, makeable grid) and `/play` (a
  stateless per-position DD oracle: legal cards + DD values), both endplay-backed.
- **Full UI redesign** — Tailwind v4 + a shadcn-style design system (tokens, light/dark, AA
  sizing), a Settings panel, redesigned Login + practice + dashboards, a **Play & Review**
  screen (DD analysis), and **interactive double-dummy play** (declarer + dummy vs DD defence,
  with hints).
- Engine tests: 9 files, **90 passing**; spike **150 cases**. Web i18n parity **166/166**.

---

## Architecture at a glance

```
web/        React (Vite) SPA → Vercel      Tailwind/shadcn design system; practice, play, dashboards, settings, i18n (LV/EN)
engine/     FastAPI → Railway              system-as-data bidder (/bid /conformance /explain) + DDS (/assess /play)
supabase/   Postgres + Auth + RLS          profiles/roles, attempts, assignments, rosters, admin RPCs
```

The spine of the product is one principle, and the code honours it consistently:

> **The engine decides correctness; the UI only renders what it returns.**

A single data file (`engine/system/natural-v1.yaml`) is read by the bot (`/bid`), the grader
(`/conformance`), and the explainer (`/explain`) — none re-implements bridge logic. The
double-dummy endpoints (`/assess`, `/play`) follow the same discipline: stateless DDS oracles
(`app/assessor.py`, `app/play.py`) that the web client orchestrates. No bridge logic is
duplicated anywhere in the UI.

---

## What's genuinely strong

1. **System-as-data design.** Encoding the bidding system as priority-ordered rules with a
   small executable `conditions` vocabulary (`engine/app/bidder.py`, `schema.md`) is elegant
   and maintainable. The `conditions` vs `promised` distinction — "why *this* hand bids it"
   vs "what *partner* may infer" — is a thoughtful, bridge-correct modelling decision.

2. **Defence-in-depth security.** Authorisation is enforced in the database, not just the UI:
   - Route guards (`ProtectedRoute`) are UX only; **RLS** is the real boundary.
   - `attempts.user_id` defaults to `auth.uid()` and RLS forbids writing rows for anyone else
     — the client literally cannot forge an attempt for another user.
   - `SECURITY DEFINER` helpers were deliberately relocated to a `private` schema so PostgREST
     won't expose them as REST RPCs (migration 0002, addressing Supabase advisors 0028/0029).
   - Every `admin_*` RPC re-checks `private.is_superadmin()` and raises `forbidden`; the
     role-change RPC validates the role and blocks self-demotion (can't lock the club out).

3. **Drift protection, two layers.** `tests/test_parity.py` re-runs the 150 signed-off
   reference cases through the runtime bidder; `tests/test_coverage.py` (driven by
   `system/vet.py`) brute-forces random hands through **every** situation to guarantee no
   null call — the contract the practice pool depends on. So neither a data edit that
   regresses a known case nor one that opens a coverage gap can land silently.

4. **Disciplined, append-only migrations.** Six well-commented migrations tell a clear story
   (foundations → hardening → attempts → roster → assignments → admin). Each explains *why*,
   not just *what*. RLS recursion is correctly avoided via the definer helpers.

5. **Good product instincts in the UI.** Fire-and-forget attempt recording never blocks
   practice; engine-down shows a friendly message; the "Why?" button explains the student's
   *own* call (not just the right answer), which is a real teaching feature.

6. **i18n parity.** `lv.json` and `en.json` are key-for-key aligned (93/93); Latvian is the
   pilot default with English fallback.

7. **The system data scales safely now.** The vetter made it possible to grow the bidding
   system aggressively without fear: each new block of rules is proven gap-free over 100k+
   random hands before shipping, and locked with spike cases. The opener-rebid tree was built
   this way — six 1-over-1 auctions, four 1NT-response auctions, two major-raise game-try
   decisions, and six 2/1 game-forcing auctions — all consistent in shape and catch-all
   discipline. The HTTP-boundary tests (`/bid`, `/conformance`, `/explain`, error contract)
   pin the router layer on top.

8. **A real design system, not ad-hoc styling.** The web app moved off inline styles onto
   Tailwind v4 tokens (`index.css`) + shadcn-style primitives, with light/dark, AA-comfortable
   sizing, a Settings panel, and bridge suit colours (4-/2-colour deck). Every screen draws
   from the same tokens, so theming is consistent and one change re-skins the app.

9. **Double-dummy oracles done right.** `/assess` and `/play` are stateless DDS endpoints with
   `endplay` imported lazily (the rest of the suite never depends on the native solver). The
   interactive play screen keeps the engine a pure oracle: it returns legal cards + DD values
   per position, and the *client* decides which seats a human controls and auto-plays the rest
   by the highest-dd card. Clean separation, verified by a full 13-trick playthrough test.

---

## Worth tidying (low effort, low risk)

- ✅ **Dead code: `web/src/practice/deals.js`** — _applied 2026-06-09._ The static `DEALS`
  array was superseded by `generate.js` and imported nowhere; the file has been deleted.

- ✅ **Unused field: `situationId` in `generate.js`** — _applied 2026-06-09._ `nextProblem()`
  no longer returns `situationId`; `BidPractice` already relies on the engine's returned
  `situation_id` (with `deal.id` as fallback).

- ✅ **Stale i18n keys (Phase 0 leftovers)** — _applied 2026-06-09._ Removed
  `dashboard.emptyStudent/emptyCoach/emptyAdmin`, `practice.dealCount`, and `auth.password`
  from both `lv.json` and `en.json` (catalogues remain key-for-key in parity, 63 keys each).

- **`deal_id` carries a situation id.** In `attempts`, `deal_id` actually stores the engine
  `situation_id`, and assignment progress joins on `deal_id = situation`. It's documented in
  migration 0005 and it works, but the column name invites confusion. A one-line note on the
  table (or a rename in a future migration) would help the next reader.

- ✅ **`.claude/` gitignored** _(2026-06-10)._ Local Claude settings (`settings.json`,
  `settings.local.json`) are now in the root `.gitignore` so they can't be committed.

- ✅ **Stale docs refreshed** _(2026-06-10)._ The root `README.md` (was "Phase 0 — endpoints
  return 501, minimal styling only") and the engine README / `doc/` index now reflect the
  current product: full bidding system, `/assess` + `/play`, and the redesigned UI.

---

## Things to watch (by design today, revisit later)

- **No automated tests on the web side.** The engine is well covered (9 test files, 90 passing:
  parity, coverage, HTTP-boundary for every endpoint incl. `/assess` and `/play`). The web has
  **zero** tests — and it has grown a lot (design system, settings, play orchestration). The
  highest-value target is the **interactive-play loop** in `InteractivePlay.jsx` (fetch/auto-play
  effects, follow-suit gating) and a render smoke for the main screens.

- **Web bundle is ~560 kB (157 kB gzip), past Vite's 500 kB warning.** Driven by `lucide-react`,
  Radix dialog, and the single chunk. Code-splitting the routes (lazy-load `/play` and the
  dashboards) or trimming icon imports would bring it down. Not urgent, but worth a pass.

- **Interactive play is "double-dummy study" mode.** All four hands are visible (like Bridge
  Solver), you control declarer + dummy, and defenders play perfect DD defence. It is *not*
  hidden-hand play vs bidding-aware bots, and there's no undo / last-trick review / claim yet.
  It also makes one `/play` round-trip per card (≤ 52 per hand) — fine (each solve is ms), but
  chatty; a future endpoint could return several plies at once.

- **The generator duplicates a little opening logic.** `generate.js` carries `opened1C/1D/1H/1S`
  predicates so opener-rebid drills deal realistic hands. They mirror the YAML opening rules
  (incl. the 15-17 / 20-21 balanced → 1NT/2NT exclusion). It's only counting, not bidding
  decisions, but it's the one place bridge logic lives outside the engine — keep it in sync if
  the opening rules change, or later have the generator ask the engine instead.

- **`explain` shows the first rule for a duplicated call.** 14 situations reuse a call across
  rules by design (e.g. Michaels `2H` appears 4× for the two-suiter variants; the two NT
  catch-alls). `explain_call` returns the *first* matching rule's meaning, so a question about
  such a call narrates one representative variant, not all. Fine today; revisit if explanations
  need to enumerate variants.

- **"Show system bid" reveals the answer without recording an attempt.** Fine for a practice
  tool, but means a student can peek then bid the shown call. Not a concern unless assignment
  targets ever become high-stakes.

- **Assignment progress counts any matching attempt since the assignment date** — including
  hands hit during *random* practice, not only focused practice. This is a reasonable choice;
  just be aware progress can advance without the student using "Practice" on the assignment.

- **CORS is locked and verified end-to-end ✅ (2026-06-10).** `ENGINE_ALLOWED_ORIGINS` =
  `https://bridge-coach.vercel.app,http://localhost:5173`, so the live engine no longer
  defaults to `*`. Confirmed against production: `bridge-coach.vercel.app` serves the current
  app (matching asset hash), the engine's preflight returns
  `access-control-allow-origin: https://bridge-coach.vercel.app`, and a foreign origin is
  rejected (400, no allow-origin header).

- **Public anon key + project ref live in `DEPLOY.md`.** That's acceptable (the anon key is
  designed to be public and RLS protects the data), and `.env.local` is correctly gitignored.
  Worth a conscious note so no *service-role* key ever lands in a committed file by habit.

- **`clubs` / `club_id` exist but are unused in the UI.** Foundation for multi-club; the flat
  one-role-per-user model is a deliberate pilot simplification (documented in `README.md`).

---

## On the stated "LLM narrates" principle

`engine/README.md` says "engines decide; the LLM only narrates on top of these outputs."
Today `/explain` returns **templated text straight from the data** (`"{call}: {meaning}"`),
not LLM-generated prose — which is arguably better for correctness and cost right now. Just
noting that the LLM narration layer is a future direction, not a current dependency. The data
already carries everything a narration layer would need (`meaning`, `promised`).

---

## Completed (most recent first, all 2026-06-10 unless noted)

- ✅ **Interactive double-dummy play** — `/play` oracle (engine) + `InteractivePlay` (web): play
  declarer + dummy vs DD defence, with best-card hints. Verified end-to-end (full 13-trick run).
- ✅ **Play & Review screen** — DD analysis of a dealt board (contract verdict, par, makeable grid).
- ✅ **Full UI redesign** — Tailwind v4 + shadcn-style design system, light/dark, Settings panel,
  redesigned Login + practice + dashboards.
- ✅ **`/assess` (DDS)** — contract result, par, makeable table (`app/assessor.py`).
- ✅ **Competitive negative-double matrix** — responder after every simple 1- and 2-level suit overcall.
- ✅ **Opener-rebid tree complete** — 1-over-1, 1NT response, major raise, 2/1.
- ✅ **Minor / 1NT responses re-enabled** + the coverage vetter (`system/vet.py`, `test_coverage.py`) — 2026-06-09.
- ✅ **Engine test layer** + `requirements-dev.txt`; **cleanup** of dead code / stale i18n — 2026-06-09.
- ✅ **CORS locked & verified**, `.claude/` gitignored, docs refreshed.

## Prioritised next steps

**P0 — launch hygiene (small; needs the Vercel/Supabase dashboards)**
1. Confirm `VITE_ENGINE_URL` is set explicitly on Vercel (not relying on the hard-coded Railway
   fallback) and that the Supabase magic-link redirect URLs include the production origin.

**P1 — quality & robustness**
2. **Add web tests** (none today). Priority: the interactive-play loop in `InteractivePlay.jsx`
   (fetch/auto-play effects, follow-suit gating) + a render smoke for practice / play / dashboards.
3. **Code-split** to cut the ~560 kB bundle (lazy-load `/play` and the dashboards; trim icons).

**P2 — play polish & cross-device settings**
4. Play table: **undo, last-trick review, claim, card-play animation**, and surface the running
   "best line" more richly.
5. Promote **Settings to the Supabase profile** so theme/deck/feedback follow a user across devices.

**P3 — later / larger**
6. Rename/annotate **`deal_id`** (stores a `situation_id`); have the generator **ask the engine**
   for opener realism instead of duplicating opening predicates.
7. **`explain` variants** (enumerate the duplicated-call meanings) and remaining competitive bits
   (opener/advancer later calls, weak-jump-overcall responses, competitive limit raises).
8. Coach-tunable **toggles UI** + a **second system** (e.g. Precision); **hidden-hand play vs bots**
   (a large feature beyond the current double-dummy study mode).

---

_See [`user-stories.md`](./user-stories.md) for the feature-by-feature breakdown with code
references and status._
