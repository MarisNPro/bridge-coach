# Documentation

Product documentation for **Bridge Coach**, derived from a deep-dive review of the codebase
(end of Phase 1, 2026-06-09).

| Document | What's inside |
|----------|---------------|
| [user-stories.md](./user-stories.md) | Feature-by-feature user stories across 8 epics (auth, student practice, assignments, coach monitoring, superadmin, engine, platform). Each story has acceptance criteria, a link to the implementing code, and a status (✅ done / 🟡 partial / ⚪ planned), plus a backlog and a traceability table. |
| [review-notes.md](./review-notes.md) | Honest code-review findings: architecture overview, what's strong, low-risk cleanups, things to watch, and suggested next steps. |

## The product in one paragraph

Bridge Coach is a bilingual (Latvian/English) platform for teaching **bridge bidding**. Students
practise on an endless supply of randomly dealt hands, make a call via a bidding box, and get
instant, objective feedback graded by a stateless engine that encodes one bidding system as data
(`natural-v1`). Coaches run a roster, assign specific situations with targets, and monitor each
student's attempts and progress. A superadmin manages users, roles, and coach↔student links.
Authorisation is enforced in the database with Row-Level Security; data is EU-hosted for GDPR.

## Architecture

```
web/        React (Vite) → Vercel      auth, role dashboards, bidding practice, i18n
engine/     FastAPI → Railway          stateless system-as-data bidder (/bid, /conformance, /explain)
supabase/   Postgres + Auth + RLS      profiles/roles, attempts, assignments, rosters, admin RPCs
```

See the repo root [`README.md`](../README.md) and [`DEPLOY.md`](../DEPLOY.md) for setup and
deployment, and [`engine/system/schema.md`](../engine/system/schema.md) for the system-as-data
contract.
