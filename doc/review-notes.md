# Bridge Coach — Code Review Notes

_Deep-dive review of the codebase as of 2026-06-10 (Phase 1 loop + system-data expansion).
Companion to [`user-stories.md`](./user-stories.md)._

This is an honest assessment: what's strong, what's worth tidying, and a few things to
watch. Nothing here is a blocker — the loop is coherent and well-built, and the engine is
**live on Railway** (`bridge-coach-production.up.railway.app`, `/health` → phase 1, deploy
tracking `main`).

**Since the 2026-06-09 baseline:** added an engine test layer (HTTP-boundary + a coverage
vetter), closed the `resp-1c/1d/1nt` rule gaps and re-enabled minor-suit / 1NT responses,
built the **complete opener-rebid tree** (1-over-1, 1NT response, major raise, 2/1), and
filled the **negative-double matrix** (responder after every simple 1- and 2-level suit overcall).
The system grew 28 → **56 situations**, ~200 → **410 rules**; the practice pool grew from
11 to **43 situations**.

---

## Architecture at a glance

```
web/        React (Vite) SPA → Vercel      auth, role dashboards, bidding practice, i18n (LV/EN)
engine/     FastAPI → Railway              stateless "system-as-data" bidder
supabase/   Postgres + Auth + RLS          profiles/roles, attempts, assignments, rosters, admin RPCs
```

The spine of the product is one principle, and the code honours it consistently:

> **The engine decides correctness; the UI only renders what it returns.**

A single data file (`engine/system/natural-v1.yaml`) is read by three consumers — the bot
(`/bid`), the grader (`/conformance`), and the explainer (`/explain`) — none of which
re-implements bridge logic. That's the right call and it's executed cleanly.

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

---

## Things to watch (by design today, revisit later)

- **No automated tests on the web side.** The engine now has an HTTP-boundary layer
  (`/bid`, `/conformance`, `/explain` contracts + hand-parse/status-code cases) plus the
  parity and coverage guards. Still no React component tests; as the UI grows, a few would
  pay off. The HTTP-boundary tests also still exercise only the `opening` situation directly —
  the newer situations lean on parity + coverage, which is adequate but narrow at the router.

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

## Completed (most recent first)

- ✅ **Opener-rebid tree — complete** (2026-06-10). 1-over-1 (6), 1NT response (4), major-raise
  game tries (2), and 2/1 game-forcing (6) — 18 situations, all vetted gap-free, spike-pinned,
  and in the practice pool with `opened1X` realism constraints.
- ✅ **Minor-suit / 1NT responses re-enabled** (2026-06-09). Built `system/vet.py`; closed the
  `resp-1c/1d/1nt` gaps with catch-all rules; added `tests/test_coverage.py`.
- ✅ **Engine test layer** (2026-06-09). HTTP-boundary tests + `requirements-dev.txt`.
- ✅ **Cleanup** (2026-06-09). Deleted `deals.js`, dropped unused `situationId`, pruned stale i18n.

## Prioritised next steps

**P0 — pre-launch correctness (small, do first)**
1. ✅ _Done (2026-06-10):_ **Vercel production origin matches `ENGINE_ALLOWED_ORIGINS`.**
   Verified `bridge-coach.vercel.app` serves the current app and the engine accepts that
   origin while rejecting others.
2. ✅ _Done (2026-06-10):_ added `.claude/` to the root `.gitignore`.
3. Confirm `VITE_ENGINE_URL` is set explicitly on Vercel (not relying on the hard-coded
   Railway fallback) and that the Supabase magic-link redirect URLs are correct. _(Needs the
   Vercel/Supabase dashboards — MCP tokens are currently expired.)_

**P1 — finish the bidding system (last of step 3)**
4. ✅ _Done (2026-06-10):_ **negative-double matrix — responder after every simple suit
   overcall**, 1-level (`resp-1c-over-1d/1h/1s`, `resp-1d-over-1h/1s`, `resp-1h-over-1s`) and
   2-level (`resp-1d-over-2c`, `resp-1h-over-2c/2d`, `resp-1s-over-2c/2d/2h`), all vetted
   gap-free and in the pool. **This effectively closes step 3's bidding-system expansion.**
   Remaining competitive work (opener/advancer later calls, weak-jump-overcall responses,
   competitive limit raises) is incremental, not a documented gap.
5. Optionally widen HTTP-boundary tests to a couple of opener-rebid / competitive situations
   (today they directly exercise only `opening`).

**P2 — next feature**
6. **`/assess` (DDS)** — extend grading from bidding to play. Endpoint is a 501 stub; `endplay`
   (with the DDS solver) already ships in `requirements.txt`.

**P3 — later / known simplifications**
7. A few **React component tests** for the practice screen and dashboards.
8. Rename/annotate **`deal_id`** (it stores a `situation_id`).
9. Have the generator **ask the engine** for opener realism instead of duplicating opening
   predicates in `generate.js` (removes the one spot bridge logic lives outside the engine).
10. Coach-tunable **toggles UI** and a **second system** (e.g. Precision) in the same data shape.

---

_See [`user-stories.md`](./user-stories.md) for the feature-by-feature breakdown with code
references and status._
