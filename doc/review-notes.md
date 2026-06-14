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
  2-level suit overcall). 28 → **90 situations**, ~200 → **558 rules**; every situation vetted.
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
- **Tooling** — engine **219 tests** (21 files); spike **150 cases**. Web: **59 Vitest tests**
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
  (cards slide in; the completing card holds with its winner highlighted) all exist. **Hidden-hand
  mode (default) + bot opponents are wired** (see below). It makes one `/play` round-trip per card
  plus one `/bot` call per opponent turn (≤ 52/hand) — fine (each is ms) but chatty.

- **Bot play: non-cheating engine + wired + auction-aware-capable.** `POST /bot` returns a
  Monte-Carlo card choice from only the hands it may see (its own + dummy once revealed), sampling
  the concealed cards and double-dummy-solving each. It also accepts optional per-seat
  **`constraints`** (hcp / suit-length ranges) and rejection-samples only consistent layouts
  (falling back to unconstrained if unmeetable) — i.e. auction-aware sampling. The play UI hides
  opponents and routes their turns through `/bot` (declare or defend). **Gap: the interactive-play
  flow has no bidding phase, so nothing feeds those constraints yet** — the capability is built +
  tested, and the pure auction logic to derive a contract + per-seat constraints now exists
  (`auction.js`, Phase 1). It becomes "bidding-aware" in the app once the **bidding UI/flow
  (Phase 2)** wires that auction in — the one remaining product piece (see the plan below).

- **`toggles` are descriptive-only — the bidder does not apply them.** The system file carries a
  `toggles` block (NT range, opening minimum, weak-two range, strong-2♣, 5-card-major NT), now
  surfaced read-only via `GET /system` and the coach **System reference** card. But every rule
  hard-codes its values; nothing reads `toggles` at runtime. Making them truly coach-tunable is a
  multi-situation engine project (e.g. a 12-14 NT cascades into the 1NT-response and rebid trees) —
  a half-wired toggle would produce incoherent bidding, so it's deferred deliberately.

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

- ◑ **Bidding coverage — PR-D-leftovers: responder after a minimum minor rebid** _(2026-06-14)._
  `1m-1M-2m` (opener minimum, no support/extras) → responder: game (4M w/ 6+ / 3NT) / invite (3M
  w/ 6+ / 2NT) / weak major signoff (2M w/ 6+) / pass the minor. `resp-rebid-{1c,1d}-{1h,1s}-2m`,
  vetted, +8 golden tests (engine 219). _Reverses + new-suit-up-the-line still deferred (forcing
  logic — own pass)._
- ◑ **Bidding coverage — PR-D: responder's rebid after a major raise** _(2026-06-14)._ `1m-1M-2M`
  (opener 12-15 + 4-card support, 8-card fit) → responder: game (4M, 12+) / invite (3M, 10-11) /
  pass (6-9). `resp-after-raise-{1c,1d}-{1h,1s}`, vetted, +6 golden tests (engine 207).
- ◑ **Bidding coverage — PR-C: major-raise game-try replies** _(2026-06-14)._ `1M-2M-3M` (opener's
  16-18 game try) → responder bids game (4M) with a maximum (8-9), else passes.
  `resp-after-gametry-1h/1s`, vetted, +4 golden tests (engine 197).
- ◑ **Bidding coverage — PR-B: responder's rebid after a 1NT rebid** _(2026-06-14)._ `1m-1M-1NT`
  (opener balanced 12-14) → responder places it: weak major signoff (2M, 5+) / invite (3M w/ 6+,
  2NT) / game (4M w/ 6+, 3NT). 4 situations (`resp-rebid-{1c,1d}-{1h,1s}-1nt`), all vetted, +9
  golden tests (engine 191).
- ◑ **Bidding coverage — PR-A: 1NT continuations** _(2026-06-14)._ Responder's placement after a
  Stayman answer (`resp-after-stayman-2d/2h/2s`) and after a transfer accept
  (`resp-after-transfer-hearts/spades`) — 4-4 fit invites/raises to game, no fit → NT, 6+ trumps
  invite/bid game, exactly 5 offers a choice. 5 situations (76 total, all vetted), +9 golden tests
  (engine 178). First lift of the auction depth ceiling past opener's rebid.
- ◑ **NT-range presets — Phase 1 (mechanism)** _(2026-06-14)._ Rules may carry a `presets` list;
  `bidder.decide` keeps only rules whose `presets` is absent or contains the active preset (from a
  `preset` field on `/bid` `/conformance`; default `strong`). Inert + parity-locked — no shipped
  rule is tagged, so natural-v1 is unchanged under any preset (spike 150). +5 tests. _P2 = author
  the Weak-NT bundle._
- ✅ **Deeper coach/admin tests** _(2026-06-14)._ CoachDashboard (expand → load attempts, assign,
  delete), SuperadminDashboard (role change, unlink), StudentDashboard (assignments + focus) — +6
  web tests over the assignment/role write paths.
- ✅ **Play-as-defender** _(2026-06-13)._ A Declare/Defend toggle on the play table: in Defend mode
  you play the opening leader (declarer's LHO) and the **bot plays the whole declaring side + your
  partner** via `/bot`; declarer is hidden, dummy shows after the lead. `botKnownHands` is now
  declaring-side-aware (declarer+dummy seen together); claim is declarer-only. +1 web test (web 33).
- ◑ **Bidding phase — Phase 2 PR-2 (bidding screen + flow)** _(2026-06-14)._ A **"Bid the deal"**
  choice on the Play screen → a `Bidding` screen: you bid **South** with `BiddingBox` while bots
  auto-call N/E/W via the runner (thinking delay); on completion it derives the contract +
  per-seat constraints, pre-fills the (adjustable) contract picker, then **Play hand** runs
  `InteractivePlay` with `constraints` (forwarded to `/bot`) and a fixed `userSeat='S'` (the auction
  decides declare vs defend). Passed-out → redeal. +2 web tests.
- ✅ **Bidding phase — Phase 2 PR-3 (tap-to-explain)** _(2026-06-14)._ Tap any call in the auction
  grid → its system meaning via `/explain` (framed to that caller's seat + role; variants listed;
  uncovered nodes show "no explanation"). +1 web test. **Bidding phase complete.**
- ◑ **Bidding phase — Phase 2 PR-1 (auction runner)** _(2026-06-14)._ `auction.js` gains
  `toEngineAuction` (frame the running auction to a seat — opp bids in parens, passes plain,
  leading passes dropped; matches the system's keys for openings/responses/opener-rebids/
  responder-over-interference), `roleOf` (opener/responder/overcaller/advancer), and a DI'd
  `botCall(getBid, …)` that returns `{seat, call, promised}` and **passes on any uncovered node**.
  +6 web tests. _No UI yet (Phase 2 PR-2)._
- ◑ **Bidding phase — Phase 1 (pure auction logic)** _(2026-06-14)._ `web/src/play/auction.js`:
  `contractFromAuction` (level/strain/declarer/doubled from a finished auction — declarer = first
  of the winning side to name the strain; later bid clears a double), `accumulateConstraints`
  (intersect each concealed seat's `promised` into hcp/length ranges for `/bot`), plus
  `auctionComplete` / `seatAt`. +11 web tests. _Not wired yet — Phase 2 adds the bidding UI + flow._
- ◑ **Bot: auction-aware (constraint) sampling** _(2026-06-13)._ `/bot` accepts per-seat
  `constraints` (hcp / suit-length ranges) and rejection-samples only consistent layouts, with a
  graceful fallback when unmeetable; response carries `constrained`. +4 engine tests. _The engine
  capability for "bidding-aware"; no consumer yet (the play flow has no bidding phase)._
- ◑ **Hidden-hand play vs bots — Phase A UI + wiring** _(2026-06-12)._ The play table now defaults
  to **hidden hands** (you see your hand + dummy after the opening lead; opponents face-down;
  reveal-all on completion, plus an Eye toggle), and opponent turns are played by the non-cheating
  **`/bot`** (sees only its hand + dummy). Web +1 test (hidden→reveal; bot-driven opponent with
  own-hand-only known_hands; claim stays DD). _(Auction-aware sampling + play-as-defender since shipped.)_
- ◑ **Hidden-hand bots — Phase B engine core** _(2026-06-12)._ `POST /bot`: a non-cheating
  Monte-Carlo card chooser. `app/bot.py` + router (+5 tests).
- ✅ **Lightweight engine telemetry** _(2026-06-12)._ A `bridge` stdout logger: an HTTP middleware
  logs `method path -> status (Nms)` for every request, and `/bid` / `/conformance` log a usage
  line (`situation_id` + call/conformance). No PII (stateless engine), no schema/UI — visible in
  Railway logs. `app/log.py` + middleware, +2 tests.
- ✅ **Runtime toggles — Phase 2 (`weak2_range` end-to-end)** _(2026-06-12)._ Engine: `open-2d/2h/2s`
  reference the toggle (golden tests; default unchanged, live-verified). Web: a **weak-2 preset**
  selector (Standard 6-10 / Aggressive 5-11 / Disciplined 8-10) in the coach **System reference**,
  persisted in settings, threaded into practice `/conformance` + `/bid` so grading follows the
  choice. `lib/toggles.js` (+4 tests), SystemReference preset (+1 test); web 31.
- ✅ **Runtime toggles — Phase 1 (mechanism + parity lock)** _(2026-06-12)._ `bidder.py` gains a
  `*_ref` resolver + `effective_toggles` deep-merge + per-request `toggles` override on `/bid` and
  `/conformance` (validated). Inert: no shipped rule uses a ref, so natural-v1 is byte-identical
  (spike 150 green). +12 engine tests on a synthetic system.
- ✅ **Coach: System reference (P2, read-only)** _(2026-06-12)._ `GET /system` returns the active
  system's name + `toggles` + situation/rule counts; a card on the coach dashboard surfaces NT
  range, opening minimum, strong-2♣, weak-2 range, and 5-card-major NT. Editing is deferred (see
  watch list). `system.py` router (+2 tests), `SystemReference` component (+2 tests).
- ✅ **Play: live DD contract tracker** _(2026-06-12)._ A badge projects the declarer's final
  result from the current position (best play both sides) — "DD: making +1 / down 1" — updating
  as you play, reusing the `/play` data already fetched. `projectedDeclarerTricks()` (+3 tests).
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

_Reprioritised 2026-06-12 (after toggles Phases 1-2). **The product is launch-ready and the major
build tracks are largely cleared.** Done: P0 production wiring; P1 play depth; the competitive tree
(71 situations, only opener's competitive rebids left); and the **runtime-toggle architecture +
`weak2_range` end-to-end** (mechanism, engine apply, coach preset selector driving practice
grading). What remains is one of: validate with real users, or take on a large new feature._

1. **Run the pilot.** ✅ _Lightweight telemetry shipped 2026-06-12:_ the engine logs every request
   (method/path/status/latency) and a per-`/bid` / `/conformance` usage line (situation + outcome)
   to stdout (visible in Railway logs) — no PII, no schema/UI. So which situations get drilled /
   missed and any errors are now observable. **The remaining action is non-code: put it in front of
   real coaches/students and let usage rank the rest.**
2. ✅ **Hidden-hand play vs bidding-aware bots — complete** _(2026-06-14)._ Bid South vs bots →
   contract + constraints → bidding-aware hidden-hand play (declare or defend), with tap-to-explain.
   The marquee feature is delivered. Residual refinement (not blocking): richer bidding depends on
   expanding the system data's auction coverage (a separate effort) — today's gaps fall to pass +
   the adjust step.
3. **NT-range toggle sub-system** (toggles Phase 3) — the architecture is proven; extend to the NT
   range only on demonstrated coach demand (a coherent "Weak/Mini NT" cascades through the whole
   `resp-1nt` ladder — its own design).
4. **Second system (Precision)** · **opener's competitive rebids** — niche / completeness; the
   second system reuses the proven `system_id` + toggle plumbing.
5. **Polish from pilot feedback** — _deeper coach/superadmin/student web tests done 2026-06-14;_
   remaining: LLM-narrated explanations on the `meaning`/`promised` data, onboarding, mobile/a11y.

### Bidding phase before play — plan (scoped 2026-06-13; Phase 1 done 2026-06-14)
Run a real auction after dealing, derive the contract + declarer, and feed each concealed seat's
auction-promised constraints into the bot's (already-built) auction-aware sampling.
- **Hard constraint:** the bidder is a *per-situation* oracle, **not auction-complete** — repeated
  `/bid` hits "no situation for auction" past the modeled nodes. So the design must handle gaps.
- **Locked decisions:** you bid **one seat**, the bot bids the other three; **pass-on-gap** when
  `/bid` has no situation (guarantees termination, sometimes underbids); a **user-adjustable final
  contract** (reuse the `PlayReview` picker) compensates; constraints come **free from the bot
  calls' `promised`** (only concealed seats need them — no `/explain`).
- ✅ **Phase 1 — pure auction logic** (`web/src/play/auction.js`, +11 tests): `contractFromAuction`,
  `accumulateConstraints`, `auctionComplete`, `seatAt`. No UI/network.
- **Phase 2 — bidding UI + flow** _(decisions: a "Bid & play" choice on the Play screen; you bid
  **South** vs bots on a random deal; show contract + allow adjust; tap a call to explain it)._
  ✅ _Complete 2026-06-14 (PR-1 runner, PR-2 bidding screen + flow, PR-3 tap-to-explain):_ "Bid the
  deal" → bid South vs bots → derive contract + constraints → adjust → play bidding-aware
  (constraints to `/bot`, `userSeat='S'` so the auction picks declare/defend); tap any call to
  explain it. Scope ceiling: bidding quality is bounded by the system data's coverage (deep /
  competitive nodes → pass), which the adjust step compensates for.
- **Phase 3 (optional):** show the auction during play; explain bot calls; competitive affordances.
- **Risk:** underbidding from gaps (mitigated by the adjust step; only fully fixed by expanding the
  system data — a separate large effort). Contract derivation is pure + exhaustively tested.

### Runtime-applied toggles — plan (decisions locked 2026-06-12)
Make `toggles` actually drive bidding (foundation for coach-tuning + a 2nd system). Key facts:
toggle values are pervasive/ambiguous in the data (`min: 12` ×112, `min: 15` ×35) so each governed
rule must be **explicitly tagged**, not find-replaced; and a toggle **cascades** (a 12-14 NT flips
the balanced 1m openings and the whole 1NT-response ladder). Locked decisions:
- **Named presets, not free ranges** — each preset ships a coherent, vetted bundle of rule values.
- **First wired toggle = `weak2_range`** (cascade is just the 3 `open-2x` rules; responses are
  robust) — _not_ `nt_range`, whose cascade is a sub-system design (deferred to Phase 3).
- **Mechanism:** rule bounds may reference a toggle (`min_ref: weak2_range.min`); a resolver merges
  the system `toggles` with an optional per-request override into an **immutable per-request view**
  (cached base never mutated); `meets()` is unchanged. Bidding + conformance share the same
  effective toggles. Coach choice persists in `profiles.prefs` (0007); students inherit.
- **Parity-locked:** no override ⇒ byte-identical behavior (150 spike cases stay green); the
  feature is inert until a non-default preset is chosen.
- **Sequencing:** ✅ Phase 1 mechanism + parity lock (inert; `bidder.py` `*_ref` resolver +
  `effective_toggles` + per-request override on `/bid` `/conformance`, +12 tests) → ✅ Phase 2:
  `weak2_range` wired end-to-end — engine applies it (`open-2d/2h/2s` reference it, golden tests,
  default unchanged + live-verified) and a coach preset selector in the System reference drives
  practice grading (persisted in settings) → Phase 3 NT-range (scoped below).

### NT-range presets — plan (scoped 2026-06-14)
Let a coach switch the 1NT range: **Strong 15-17** (default, today) / **Weak 12-14** / **Mini 10-12**.
Grounded cascade (from the rules):
- **Opening is easy:** the 1-suit openings don't exclude balanced 15-17 — `open-1nt` just sits above
  them in priority, so the balanced ladder is implicit. Changing the 1NT band is essentially the one
  `open-1nt` rule (everything else flows: e.g. under Weak, 15-17 balanced falls through to a 1-suit
  opening automatically).
- **The cascade is in the *derived* bands**, which assume a 15-17 opener and so **cannot** be
  `*_ref`-tagged like `weak2_range`:
  - `resp-1nt` (~6-8 point bands: Pass 0-7, 2NT invite 8-9, 3NT/Stayman 8-10+, quant 16-17, 6NT 18+) —
    these are *combined-total* thresholds; for a 12-14 opener game needs responder ~13 (not ~10), invite
    ~11-12, etc. Every band shifts.
  - `opener-rebid-{1c,1d,1h,1s}-1nt` balanced bands (Pass 12-14 / 2NT 18-19) shift, since under Weak a
    12-14 balanced opener bid 1NT rather than a suit.
  → ~15-20 rules, several requiring **bridge judgment** (a curated bundle per preset), not min/max swaps.
- **Mechanism (new, ≠ weak2 refs):** add an optional **`presets:` guard on rules**; the bidder filters
  to rules whose `presets` is absent (apply always) or contains the active preset, before first-match.
  Default preset = `strong` ⇒ untagged rules behave exactly as today (parity-locked). The active NT
  preset rides on the `/bid` `/conformance` request (alongside the existing toggles).
- **Sequencing:** ✅ _P1 mechanism done 2026-06-14_ (`presets` rule guard in `bidder.decide` +
  `preset` on `/bid` `/conformance`; default `strong`; untagged rules apply always → natural-v1
  parity-inert; +5 tests) → P2
  author the **Weak-NT** bundle (open-1nt band + the `resp-1nt` weak ladder + the four opener-rebid-1nt
  bands) with **golden tests per preset** + re-vet under each preset → P3 NT preset selector in the
  System reference, threaded into practice + the bidding flow → P4 (optional) Mini-NT bundle.
- **Risks:** response-ladder coherence is the real work (mitigated by golden tests pinning each preset);
  parity for the default; coverage must be vetted under every preset. **Recommendation:** build only on
  demonstrated coach demand — start Strong+Weak; defer Mini. Effort: multi-PR (P2's `resp-1nt`
  re-authoring is the bulk and needs bridge sign-off).

### Expanding bidding coverage — plan (scoped 2026-06-14)
**Deep-dive finding:** the auction tree has a hard **depth ceiling at 4 calls** (opener's rebid).
Situations by key length: 0→1, 1→7, 2→21, 3→20, 4→22, and **nothing deeper**. There are **no
responder-rebid situations and no 1NT-system continuations** past opener's answer — so every
constructive auction dies at opener's rebid (responder passes), capping contracts at whatever the
rebid was (game only when opener jumped). This is the root cause of thin bid-vs-bots auctions.

Goal: author the **next layer** so common auctions reach a sensible game / part-score. Pure content
work, protected exactly like the opener-rebid tree was: every new situation ends in a `{}` catch-all
(vetter proves 0 null calls over 20k hands), golden `/bid` tests pin representative calls, and the
spike-150 parity guard + coverage test gate every change. Each branch is its own PR.

- ✅ **PR-A — 1NT-system continuations** _(done 2026-06-14)._ Responder after a Stayman answer
  (`resp-after-stayman-2d/2h/2s`) and after a transfer accept (`resp-after-transfer-hearts/spades`)
  — 5 situations, vet-safe, +9 golden tests.
- ✅ **PR-B — responder's rebid after opener's 1NT rebid** _(done 2026-06-14)._ `1m-1M-1NT` →
  signoff (2M) / invite (3M, 2NT) / game (4M, 3NT). 4 situations, vet-safe, +9 golden tests.
- ✅ **PR-C — major-raise game-try replies** _(done 2026-06-14)._ `1M-2M-3M` → responder accepts
  (4M, 8-9) or passes. `resp-after-gametry-1h/1s`, vet-safe, +4 golden tests.
- ✅ **PR-D — responder's rebid after a major raise** _(done 2026-06-14)._ `1m-1M-2M` → game (4M) /
  invite (3M) / pass. `resp-after-raise-{1c,1d}-{1h,1s}`, vet-safe, +6 golden tests. Plus
  **minimum-minor replies** `resp-rebid-{1c,1d}-{1h,1s}-2m` (same ladder, +8 tests). _(Reverses +
  new-suit-up-the-line still deferred — they're forcing and need their own careful pass.)_
- **PR-E (optional) — slam responses**: Blackwood `4NT → 5x` ace-showing; quantitative follow-ups.

**Sequencing:** PR-A first (bounded, immediate "1NT auctions reach game"), then B, C, D; E optional.
**Risks:** bridge correctness of the new bands is judgment — mitigated by golden tests + matching the
existing tree's documented conventions; scope creep bounded by one named branch per PR. Effort: each
PR ≈ 6-10 situations (author + vet + tests); the full responder-rebid tree is multi-PR.

---

_See [`user-stories.md`](./user-stories.md) for the feature-by-feature breakdown with code
references and status._
