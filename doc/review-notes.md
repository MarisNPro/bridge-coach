# Bridge Coach — Code Review Notes

_Deep-dive review of the codebase as of 2026-06-09 (end of Phase 1). Companion to
[`user-stories.md`](./user-stories.md)._

This is an honest assessment: what's strong, what's worth tidying, and a few things to
watch. Nothing here is a blocker — the Phase 1 loop is coherent and well-built.

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

3. **Drift protection.** `tests/test_parity.py` re-runs the 131 signed-off reference cases
   through the runtime bidder, so edits to the data or evaluator can't silently regress.

4. **Disciplined, append-only migrations.** Six well-commented migrations tell a clear story
   (foundations → hardening → attempts → roster → assignments → admin). Each explains *why*,
   not just *what*. RLS recursion is correctly avoided via the definer helpers.

5. **Good product instincts in the UI.** Fire-and-forget attempt recording never blocks
   practice; engine-down shows a friendly message; the "Why?" button explains the student's
   *own* call (not just the right answer), which is a real teaching feature.

6. **i18n parity.** `lv.json` and `en.json` are key-for-key aligned; Latvian is the pilot
   default with English fallback.

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

---

## Things to watch (by design today, revisit later)

- **No automated tests on the web side.** The engine now has an HTTP-boundary layer
  (`/bid`, `/conformance`, `/explain` contracts + hand-parse/status-code cases) on top of the
  parity test — _added 2026-06-09._ Still no React component tests; as the UI grows, a few would
  pay off.

- **"Show system bid" reveals the answer without recording an attempt.** Fine for a practice
  tool, but means a student can peek then bid the shown call. Not a concern unless assignment
  targets ever become high-stakes.

- **Assignment progress counts any matching attempt since the assignment date** — including
  hands hit during *random* practice, not only focused practice. This is a reasonable choice;
  just be aware progress can advance without the student using "Practice" on the assignment.

- **CORS + engine URL defaults.** The engine defaults `allow_origins=["*"]`, and the web client
  falls back to a hard-coded Railway URL. Both are sensible for the pilot and already flagged in
  `DEPLOY.md` ("lock CORS before real users") — just make sure that step happens before launch.

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

## Suggested next steps (not prescriptive)

1. ✅ _Done (2026-06-09):_ deleted `deals.js`, dropped the unused `situationId` field, pruned
   stale i18n keys.
2. ✅ _Done (2026-06-09):_ added a thin engine test layer — `/bid` / `/conformance` / `/explain`
   contract cases plus hand-parse and status-code error cases (`engine/tests/`,
   `requirements-dev.txt`), so the system data can grow safely.
3. Fill the largest documented gaps when ready: the **opener-rebid tree** and the **competitive
   responder-after-interference matrix**, then re-enable minor-suit / 1NT responses in the
   practice pool.
   - ✅ _Done (2026-06-09):_ **minor-suit / 1NT responses re-enabled.** Built a coverage vetter
     (`engine/system/vet.py`) that brute-forces random hands for null calls; it found the only
     gaps were `resp-1c` / `resp-1d` / `resp-1nt` (strong no-major and weak long-minor hands).
     Closed them with catch-all rules, re-added all three to the practice pool, and added a CI
     guard (`engine/tests/test_coverage.py`) so no situation can ever return a null call again.
   - ✅ _Done (2026-06-09):_ **opener-rebid tree, 1-over-1 responses.** All six
     `opener-rebid-1x-1y` situations (raises, 1-level new suits, reverses, jump rebids, NT
     rebids, minimum-rebid catch-all), vetted gap-free and added to the practice pool as
     assignable skills. These are the first pool situations where the actor's hand is
     constrained by prior bidding, so the generator resamples to deal hands consistent with
     what the opening promised (`web/src/practice/generate.js`).
   - ✅ _Done (2026-06-09):_ opener's rebid after a **1NT response** (`opener-rebid-1{c,d,h,s}-1nt`)
     and the **game-try decision** after a simple major raise (`opener-rebid-1h-2h` / `1s-2s`),
     vetted gap-free and added to the pool. Also tightened the generator's realism constraint to
     exclude 15-17 / 20-21 balanced hands (those open 1NT / 2NT, not a suit).
   - ✅ _Done (2026-06-09):_ the **2/1 (game-forcing) opener rebids** (`opener-rebid-1{h,s}-2{c,d}`,
     `1s-2h`, `1d-2c`), vetted gap-free and in the pool. **The opener-rebid tree is now complete.**
   - ⏳ _Still open:_ the **full competitive matrix** — responder-after-interference / negative
     doubles across the remaining opening × overcall pairs. This is the last piece of step 3.
4. Implement **`/assess`** (DDS) to extend grading from bidding to play.
5. Before the pilot launch: set `ENGINE_ALLOWED_ORIGINS` to the web origin and `VITE_ENGINE_URL`
   explicitly; confirm the Supabase magic-link redirect URLs.

---

_See [`user-stories.md`](./user-stories.md) for the feature-by-feature breakdown with code
references and status._
