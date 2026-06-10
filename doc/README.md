# Documentation

Product documentation for **Bridge Coach**, derived from a deep-dive review of the codebase
(2026-06-10 — bidding system complete, double-dummy `/assess` + `/play`, full UI redesign,
and interactive play; all live on Vercel + Railway).

| Document | What's inside |
|----------|---------------|
| [user-stories.md](./user-stories.md) | Feature-by-feature user stories across 8 epics (auth, student practice, assignments, coach monitoring, superadmin, engine, platform). Each story has acceptance criteria, a link to the implementing code, and a status (✅ done / 🟡 partial / ⚪ planned), plus a backlog and a traceability table. |
| [review-notes.md](./review-notes.md) | Honest code-review findings: architecture overview, what's strong, low-risk cleanups, things to watch, and suggested next steps. |

## The product in one paragraph

Bridge Coach is a bilingual (Latvian/English) platform for teaching **bridge**. Students practise
bidding on an endless supply of randomly dealt hands, make a call via a bidding box, and get
instant, objective feedback graded by a stateless engine that encodes one bidding system as data
(`natural-v1`). They can also **play & review** deals — deal a board, choose a contract, and see
the double-dummy result, or play it out card-by-card against double-dummy defence with hints.
Coaches run a roster, assign situations with targets, and monitor progress; a superadmin manages
users, roles, and coach↔student links. The UI is a modern Tailwind/shadcn-style design system with
light/dark themes and a settings panel. Authorisation is enforced in the database with Row-Level
Security; data is EU-hosted for GDPR.

## Architecture

```
web/        React (Vite) → Vercel      auth, dashboards, practice, play & review, settings, i18n
engine/     FastAPI → Railway          system-as-data bidder (/bid /conformance /explain) + DDS (/assess /play)
supabase/   Postgres + Auth + RLS      profiles/roles, attempts, assignments, rosters, admin RPCs
```

See the repo root [`README.md`](../README.md) and [`DEPLOY.md`](../DEPLOY.md) for setup and
deployment, and [`engine/system/schema.md`](../engine/system/schema.md) for the system-as-data
contract.
