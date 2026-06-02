# Phase 0 — Foundations

Goal (Definition of Done): **log in as superadmin / coach / student and land on a
role-appropriate empty screen.** No bridge logic yet — that arrives in Phase 1.

Three pieces, matching the technical plan:

    web/        React (Vite) — Vercel        auth + role routing + empty dashboards, i18n (LV/EN)
    engine/     FastAPI — Railway            stateless skeleton, health + stubbed /bid /assess /explain
    supabase/   Postgres + Auth + RLS        schema, flat roles, signup trigger, RLS policies

## Setup order

1. **Supabase** — create the project in an **EU region** (GDPR). Run
   `supabase/migrations/0001_foundations.sql` in the SQL editor.
   Enable Email OTP (magic link) auth.
2. **Web** — `cd web && npm install`. Copy `.env.example` → `.env.local`,
   fill in the Supabase URL + anon key. `npm run dev`.
3. **Promote yourself** — sign in once, find your id in `auth.users`,
   then set `role = 'superadmin'` (see the commented seed at the bottom
   of the migration). New users default to `student`.
4. **Engine** — `cd engine && pip install -r requirements.txt && uvicorn app.main:app --reload`.
   Confirm `GET /health` returns `{"status":"ok","phase":0}`.
5. **Deploy** — push web to Vercel, engine to Railway (both from GitHub).

## What's deliberately NOT here (later phases)

- No bidding/assessment logic — engine endpoints return 501 (Phase 1).
- No deals/attempts/skill_results tables — added when the loop needs them.
- Minimal styling only — the design pass comes with the bidding-table UI.

## Decision recorded

- **Flat role model**: one role per user on `profiles.role`. Sufficient for a
  single pilot club; migrate to scoped roles later if a user must hold
  different roles in different clubs.
- **Roster + role changes are superadmin-only** in RLS, so the roster stays
  authoritative during the pilot.
