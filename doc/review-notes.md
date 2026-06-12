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
  2-level suit overcall). 28 → **71 situations**, ~200 → **471 rules**; every situation vetted.
- **Double-dummy play** — `/assess` (contract result, par, makeable grid) and `/play` (a
  stateless per-position DD oracle: legal cards + DD values), both endplay-backed.
- **Full UI redesign** — Tailwind v4 + a shadcn-style design system (tokens, light/dark, AA
  sizing), a Settings panel, redesigned Login + practice + dashboards, a **Play & Review**
  screen (DD analysis), and **interactive double-dummy play** (declarer + dummy vs DD defence,
  with hints, **undo / take-back, and last-trick review**).
- **Settings sync** — display/training prefs persist to the Supabase profile (migration 0007),
  so theme / deck / text size / feedback follow a user across devices.
- **`/explain` variants** — a call reused across rules (e.g. Michaels `2H`) returns every meaning.
- **Competitive tree + Claim** — advancing partner's overcall: 1-level major (4), weak jump in a
  major (5), and simple 2-level (6 situations); **competitive limit raises** (an invitational
  10-11 jump raise in the six major-support negative-double situations); plus a **Claim** on the
  play table that auto-resolves the rest to the double-dummy result.
- **Tooling** — engine **132 tests** (11 files); spike **150 cases**. Web: **21 Vitest tests**
  (auth, practice loop, dashboard, play orchestration + claim, logic/render), i18n parity held
  (en ⇄ lv), route-code-split bundle (no chunk > 500 kB). **CI** (GitHub Actions) runs pytest +
  web test/build on every PR.

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

- ✅ **Tests + CI in place** _(2026-06-10)._ Engine 101 tests; web 18 Vitest tests covering the
  deal/generator logic, bridge rendering, interactive-play orchestration, the auth/login flow,
  the practice grade-and-record path, and a dashboard smoke. CI runs both suites + the web build
  on every PR. _Remaining gaps:_ coach/superadmin deeper flows and the assignment write path.

- ✅ **Bundle code-split** _(2026-06-10)._ The former single ~560 kB chunk is now route-lazy
  (`React.lazy` + `Suspense` in `App.jsx`) with vendor splits (supabase / i18n / vendor). No chunk
  exceeds 500 kB; the heavy `/play` UI loads only when visited.

- **Interactive play is "double-dummy study" mode.** All four hands are visible (like Bridge
  Solver), you control declarer + dummy, and defenders play perfect DD defence. Undo / take-back,
  last-trick review, **Claim** (auto-resolve to the DD result), and an animated trick compass
  (cards slide in; the completing card holds with its winner highlighted) all exist; it's still
  *not* hidden-hand play vs bidding-aware bots. It makes one `/play` round-trip per card
  (≤ 52/hand) — fine (each solve is ms) but chatty; a future endpoint could batch plies.

- **Two manual migrations are pending in production.** `0007_profile_prefs.sql` (activates the
  settings sync — the web code degrades gracefully without it) and `0008_deal_id_comment.sql`
  (a doc-only `COMMENT`). Both must be run in the Supabase SQL editor.

- **The generator duplicates a little opening logic.** `generate.js` carries `opened1C/1D/1H/1S`
  predicates so opener-rebid drills deal realistic hands. They mirror the YAML opening rules
  (incl. the 15-17 / 20-21 balanced → 1NT/2NT exclusion). It's only counting, not bidding
  decisions, but it's the one place bridge logic lives outside the engine — keep it in sync if
  the opening rules change, or later have the generator ask the engine instead.

- ✅ **`explain` enumerates duplicated-call variants** _(2026-06-10)._ 14 situations reuse a call
  across rules (e.g. Michaels `2H` ×4; the NT catch-alls). `explain_call` now returns every
  matching rule in `variants` (`meaning`/`text` keep the first, back-compatible), and the
  practice "Why?" lists them all when there's more than one.

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

- ✅ **Play: animated trick compass** _(2026-06-12)._ The trick renders as a mini-compass; cards
  slide in as played, and the completing card now holds with its **winning card highlighted**
  (fixing the prior gap where the 4th card never appeared). `trickWinner()` in `deal.js` (+3 tests).
- ✅ **P0 production wiring** _(2026-06-12)._ Magic-link Site URL + redirect allow-list and OTP
  expiry (1800s) set via the Management API; the `auth_otp_long_expiry` advisor cleared.

- ✅ **Competitive: advance partner's overcall** — 1-level major (4), weak jump in a major (5),
  and simple 2-level (6 situations); **competitive limit raises** (invitational 10-11 jump raise
  in the 6 major-support negative-double situations) + **Play: Claim** (auto-resolve to the
  double-dummy result). +26 engine tests (incl. regression pins), +1 web test; 71 situations.
- ✅ **Supabase migrations applied + advisor hardening** — `prefs` column (0007), `deal_id`
  comment (0008), and **0009**: revoked `anon` EXECUTE on the admin/coach/student RPCs (kept
  `authenticated`) and wrapped `auth.uid()` in RLS policies as `(select auth.uid())`. Advisors
  re-run: the 8 anon-execute (0028) and 9 RLS-initplan (0003) lints cleared. Remaining notices
  are by-design (`0029` authenticated execute — self-guarded RPCs) or pilot-irrelevant
  (multiple-permissive policies, unindexed `club_id`, OTP-expiry/leaked-password auth config).
- ✅ **P3: `/explain` variants** (enumerate duplicated-call meanings) + **`deal_id` annotated**
  (migration 0008 `COMMENT`, no risky rename).
- ✅ **Widened web tests** — auth/login flow, practice grade-and-record loop, dashboard smoke (17 total).
- ✅ **CI** (GitHub Actions) — engine pytest + web test/build on every PR and push to main.
- ✅ **Play polish + settings sync** — undo/take-back + last-trick review on the play table;
  prefs persist to the Supabase profile (migration 0007).
- ✅ **Web tests + code-split (P1)** — Vitest suite + route-level `React.lazy` + vendor chunk splits.
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

**P0 — finish production wiring (yours; needs the dashboards)**
1. Run the two pending migrations in Supabase: **`0007_profile_prefs.sql`** (turns on settings
   sync) and **`0008_deal_id_comment.sql`** (doc comment).
2. Confirm the Supabase **magic-link redirect URLs** include the production origin
   (`https://bridge-coach.vercel.app`), so sign-in links land back on the app.
3. ✅ _Verified (2026-06-10):_ the engine URL is correct — the deployed app reaches the production
   Railway engine (its hard-coded fallback), confirmed end-to-end. Setting `VITE_ENGINE_URL`
   explicitly on Vercel is optional hardening, not required.

**P1 — play depth** (the most user-visible next gains)
3. Play table: a richer running double-dummy line / contract-tracker. (Undo, last-trick, Claim,
   and the animated trick compass already shipped.)
4. Continue the **competitive tree**: opener's competitive rebids across the other openings (the
   one remaining branch). _Advancing partner's overcall (1-level major, weak jump, simple 2-level)
   and competitive limit raises in the major-support negative-double situations are now complete._

**P2 — coach power tools**
5. Coach-tunable **toggles UI** over the existing `toggles` data (NT range, weak-two rules, etc.).
6. A **second bidding system** (e.g. Precision) in the same data shape (`system_id` is already
   parameterised through the API).

**P3 — larger bets**
7. **Hidden-hand play vs bidding-aware bots** (beyond the current double-dummy study mode) — the
   biggest single feature; needs a bidding+play bot and a different play UI.
8. Deeper web tests (coach/superadmin flows, assignment writes); LLM-narrated explanations on top
   of the `meaning`/`promised` data.

---

_See [`user-stories.md`](./user-stories.md) for the feature-by-feature breakdown with code
references and status._
