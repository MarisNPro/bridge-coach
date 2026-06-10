# Bridge Coach

A bilingual (Latvian default, English fallback) platform for teaching **bridge** —
bidding practice graded against a bidding system encoded as data, plus
double-dummy **play & analysis**. EU-hosted for GDPR; live on Vercel (web),
Railway (engine), and Supabase (data/auth).

## What's built

**Engine** — a stateless FastAPI service; the source of record for "what's correct?".
- `/bid`, `/conformance`, `/explain` — the system-as-data bidder over `natural-v1.yaml`
  (56 situations / ~410 rules: openings, responses, the full opener-rebid tree, and the
  competitive negative-double matrix; vetted gap-free).
- `/assess` — double-dummy assessment of a played deal (contract result, par, makeable grid).
- `/play` — double-dummy play oracle (legal cards + DD values per position) for interactive play.

**Web** — a React (Vite) SPA on a Tailwind + shadcn-style design system (light/dark, AA sizing).
- **Practice** — endless random hands, a bidding box, instant graded feedback with explanations.
- **Assignments** — coaches set situations + targets; students drill them; progress tracked.
- **Coach / Superadmin** dashboards — roster, attempts, role & coach↔student management.
- **Play & Review** — deal a board, pick a contract, see the double-dummy verdict + makeable grid.
- **Interactive play** — play declarer + dummy card-by-card vs double-dummy defence, with hints.
- **Settings** — theme, text size, card deck colours (4-/2-colour), feedback depth.

**Supabase** — Postgres + Auth (magic-link) + Row-Level Security; profiles/roles, attempts,
assignments, rosters, and `SECURITY DEFINER` admin RPCs.

## Architecture

```
web/        React (Vite) → Vercel      auth, dashboards, practice, play, settings, i18n (LV/EN)
engine/     FastAPI → Railway          stateless bidder (/bid /conformance /explain) + DDS (/assess /play)
supabase/   Postgres + Auth + RLS      profiles/roles, attempts, assignments, rosters, admin RPCs
```

The spine: **the engine decides correctness; the UI only renders what it returns.** A single
data file (`engine/system/natural-v1.yaml`) is read by the bot, the grader, and the explainer;
the DDS endpoints add play analysis without duplicating bridge logic.

## Run locally

```bash
# Engine (Python 3.12 target)
cd engine && pip install -r requirements-dev.txt
uvicorn app.main:app --reload        # GET /health -> {"status":"ok","phase":1}
pytest                               # parity, coverage, HTTP-boundary, /assess, /play

# Web
cd web && npm install
cp .env.example .env.local           # Supabase URL + anon key; VITE_ENGINE_URL optional
npm run dev
```

New users default to the `student` role; promote yourself to `superadmin` once via the
commented seed in `supabase/migrations/0001_foundations.sql`.

## Deploy

Web → Vercel (`web/`, SPA fallback), engine → Railway (Docker), data → Supabase (EU region).
See [`DEPLOY.md`](./DEPLOY.md) for the runbook (incl. locking `ENGINE_ALLOWED_ORIGINS` to the
web origin — already done in production).

## Docs

- [`doc/`](./doc/) — user stories, code-review notes, and prioritised next steps.
- [`engine/system/schema.md`](./engine/system/schema.md) — the system-as-data contract.

## Decisions recorded

- **Flat role model** — one role per user on `profiles.role`; sufficient for a single pilot club.
- **Roster + role changes are superadmin-only** in RLS, so the roster stays authoritative.
- **Display/training settings live in `localStorage`** for now (not yet synced to the profile).
