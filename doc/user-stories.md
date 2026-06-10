# Bridge Coach — User Stories

_Reverse-engineered from the codebase as of 2026-06-09 (end of Phase 1)._

These user stories describe the product **as actually built**. Each story links to
the code that implements it and carries a status:

| Status | Meaning |
|--------|---------|
| ✅ | Implemented and wired end-to-end |
| 🟡 | Partially implemented / stubbed / representative coverage |
| ⚪ | Planned — named in docs or schema, not yet built |

**Personas**

- **Student** — a club player practising bidding. Default role for every new sign-up.
- **Coach** — runs a roster of students, assigns practice, monitors progress.
- **Superadmin** — administers the club: manages users, roles, and coach↔student links.
- **Engine** — the stateless service of record for "what is the correct call?". Not a
  person, but several stories describe its contract because the whole product leans on it.

The product is bilingual (Latvian default, English fallback) and EU-hosted for GDPR.

---

## Epic A — Authentication & Onboarding

### A1 — Passwordless sign-in ✅
**As a** club member, **I want** to sign in with just my email (a magic link), **so that**
I don't have to manage a password.

**Acceptance criteria**
- The login screen asks only for an email address and sends a one-time magic link
  (`signInWithOtp`).
- After submitting, I see a "check your email" confirmation instead of the form.
- Clicking the link returns me to the app, signed in, and the session persists across reloads.
- Errors from the auth provider are surfaced, not swallowed.

**Implemented by** — [`web/src/auth/Login.jsx`](../web/src/auth/Login.jsx),
[`web/src/auth/AuthProvider.jsx`](../web/src/auth/AuthProvider.jsx),
[`web/src/lib/supabase.js`](../web/src/lib/supabase.js)

### A2 — Automatic profile on first sign-in ✅
**As a** new user, **I want** my account set up automatically the first time I sign in,
**so that** I land in the app without an onboarding form.

**Acceptance criteria**
- A `profiles` row is created by a database trigger when the `auth.users` row is inserted.
- New users default to the `student` role and `lv` locale.
- `display_name` comes from sign-up metadata if present, otherwise the email's local part.
- Re-running the trigger never duplicates a profile (`on conflict do nothing`).

**Implemented by** — `private.handle_new_user()` trigger in
[`supabase/migrations/0002_private_helpers.sql`](../supabase/migrations/0002_private_helpers.sql)
(originally [`0001_foundations.sql`](../supabase/migrations/0001_foundations.sql))

### A3 — Role-appropriate landing ✅
**As a** signed-in user, **I want** the app to take me straight to the dashboard for my role,
**so that** I never see screens that aren't mine.

**Acceptance criteria**
- Visiting `/` redirects: superadmin → `/admin`, coach → `/coach`, everyone else → `/student`.
- While the profile is still loading, no premature redirect happens.
- An unauthenticated visitor is sent to `/login`.

**Implemented by** — `Home` in [`web/src/App.jsx`](../web/src/App.jsx)

### A4 — Route-level access control ✅
**As the** platform, **I want** each route to enforce which roles may enter, **so that** a
student can't open the coach or admin tools by typing the URL.

**Acceptance criteria**
- `/student` is open to student, coach, superadmin; `/coach` to coach + superadmin; `/admin`
  to superadmin only.
- A user whose role isn't allowed is redirected home rather than shown the page.
- Unknown routes redirect to `/`.
- _Note:_ this is UX-level gating; the authoritative protection is database RLS (Epic H).

**Implemented by** — [`web/src/auth/ProtectedRoute.jsx`](../web/src/auth/ProtectedRoute.jsx),
[`web/src/App.jsx`](../web/src/App.jsx)

### A5 — Sign out ✅
**As a** signed-in user, **I want** a visible sign-out control, **so that** I can end my session
on a shared computer.

**Implemented by** — `Shell` header in [`web/src/pages/Shell.jsx`](../web/src/pages/Shell.jsx)

### A6 — Interface in my language ✅
**As a** Latvian-speaking player, **I want** the whole interface in Latvian by default,
**so that** the tool is usable for the pilot club; English is the fallback.

**Acceptance criteria**
- UI starts in Latvian (`lng: 'lv'`), falls back to English for any missing key.
- After sign-in the language switches to the locale stored on my profile.
- Both `lv` and `en` translation catalogues exist and stay key-for-key in parity.

**Implemented by** — [`web/src/i18n/index.js`](../web/src/i18n/index.js),
[`web/src/i18n/lv.json`](../web/src/i18n/lv.json),
[`web/src/i18n/en.json`](../web/src/i18n/en.json),
locale switch in [`web/src/auth/AuthProvider.jsx`](../web/src/auth/AuthProvider.jsx)

---

## Epic B — Student: Bidding Practice

### B1 — Unlimited practice problems ✅
**As a** student, **I want** an endless supply of practice hands, **so that** I can drill until a
situation feels automatic.

**Acceptance criteria**
- Each problem is a freshly dealt random 13-card hand placed into one of the vetted bidding
  situations (opening, responses, overcalls, advancing a takeout double, etc.).
- "Next" always produces a new problem; there is no fixed deck to exhaust.
- The pool is restricted to situations vetted against the engine (200k random hands, no null
  calls / errors — [`engine/system/vet.py`](../engine/system/vet.py), guarded in CI by
  [`engine/tests/test_coverage.py`](../engine/tests/test_coverage.py)). Minor-suit (1♣/1♦) and
  1NT responses were re-enabled once their rule gaps were closed (2026-06-09).

**Implemented by** — [`web/src/practice/generate.js`](../web/src/practice/generate.js),
[`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx)

### B2 — Readable hand & auction ✅
**As a** student, **I want** my hand and the auction shown with proper suit symbols and colours,
**so that** I read the problem the way I would at the table.

**Acceptance criteria**
- The hand renders four suit rows (♠♥♦♣) with red hearts/diamonds and `10` for tens.
- The auction shows each prior call; opponents' calls appear in muted parentheses; a bold `?`
  marks that it's my turn. An empty auction reads "You open the bidding."

**Implemented by** — `Hand` / `Call` in
[`web/src/practice/bridge.jsx`](../web/src/practice/bridge.jsx),
`Auction` in [`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx)

### B3 — Make a call with a bidding box ✅
**As a** student, **I want** to tap a call from a familiar bidding box, **so that** entering my
answer feels like real bidding.

**Acceptance criteria**
- The box offers Pass / Double / Redouble and the full grid of 1♣…7NT.
- The selected call is visually highlighted.
- Bidding legality is intentionally **not** enforced in the UI — the engine grades whatever
  call is submitted.

**Implemented by** — [`web/src/practice/BiddingBox.jsx`](../web/src/practice/BiddingBox.jsx)

### B4 — Grade my call against the system ✅
**As a** student, **I want** to check whether my call matches the bidding system, **so that** I
get immediate, objective feedback.

**Acceptance criteria**
- "Check" sends hand + auction + my call to the engine's `/conformance` endpoint.
- A correct call shows a green "Correct!" panel with the call's meaning.
- An incorrect call shows a red panel — grading is "first matching rule wins", so exactly one
  call is correct per hand.

**Implemented by** — `onCheck` in
[`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx),
[`web/src/lib/engine.js`](../web/src/lib/engine.js),
engine [`/conformance`](../engine/app/routers/conformance.py)

### B5 — See the correct call and why it's right ✅
**As a** student who bid wrong, **I want** to see the system's call and what it means, **so that**
I learn the rule, not just that I missed.

**Acceptance criteria**
- On a miss, the panel shows the expected call (rendered as a bridge call) and its
  plain-language meaning, drawn straight from the system data.

**Implemented by** — result panel in
[`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx) (`expected_call`,
`expected_meaning`)

### B6 — "Why?" — explain my own call ✅
**As a** student, **I want** a "Why?" button that tells me what *my* (wrong) call would have
meant, **so that** I understand the gap between what I said and what I held.

**Acceptance criteria**
- After a miss, "Why?" (Latvian "Kāpēc?") calls `/explain` for the student's chosen call in
  this auction and shows that call's meaning, or "that call isn't defined in this situation".

**Implemented by** — `onWhy` in
[`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx),
engine [`/explain`](../engine/app/routers/explain.py)

### B7 — Reveal the system's bid ✅
**As a** student, **I want** to reveal the system's bid without first guessing, **so that** I can
study a hand I'm unsure about.

**Acceptance criteria**
- "Show system bid" calls `/bid` and displays the call plus its meaning.

**Implemented by** — `onShow` in
[`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx),
engine [`/bid`](../engine/app/routers/bid.py)

### B8 — Track my progress ✅
**As a** student, **I want** to see how I'm doing this session and all-time, **so that** I feel
my improvement.

**Acceptance criteria**
- A live "This session: c/n" counter updates with every checked call.
- An "All-time: solved/total" figure reads my lifetime totals from the database and refreshes
  after each attempt.

**Implemented by** — session state in
[`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx),
`fetchStats` in [`web/src/lib/attempts.js`](../web/src/lib/attempts.js)

### B9 — Every attempt is saved ✅
**As a** student, **I want** my graded attempts recorded, **so that** my coach can see my work and
my stats persist across devices.

**Acceptance criteria**
- Each checked call inserts a row into `attempts` (hand, auction, seat, my call, expected call,
  conformant flag, situation id).
- The row is attributed to me automatically — the client cannot write an attempt for another
  user (column defaults to `auth.uid()`, enforced by RLS).
- Recording is fire-and-forget: a save failure never blocks practice.

**Implemented by** — `recordAttempt` in [`web/src/lib/attempts.js`](../web/src/lib/attempts.js),
[`supabase/migrations/0003_attempts.sql`](../supabase/migrations/0003_attempts.sql)

### B10 — Resilience when the engine is down ✅
**As a** student, **I want** a clear message if grading can't reach the engine, **so that** I'm not
stuck staring at a dead button.

**Acceptance criteria**
- A network/CORS failure shows "Couldn't reach the engine. Try again." rather than a crash.
- Engine HTTP errors (e.g. 422 malformed hand, 404 unknown system) surface their detail message.

**Implemented by** — `post`/error handling in [`web/src/lib/engine.js`](../web/src/lib/engine.js),
`describe`/error state in [`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx)

---

## Epic C — Student: Assignments

### C1 — See what my coach assigned ✅
**As a** student, **I want** to see the practice my coach set me with my progress, **so that** I
know what to work on.

**Acceptance criteria**
- The student dashboard lists assignments addressed to me, each showing the situation name and
  "Done: solved/target".
- The list is read through an RLS-scoped RPC that returns only my own assignments.

**Implemented by** — [`web/src/pages/StudentDashboard.jsx`](../web/src/pages/StudentDashboard.jsx),
`student_assignments()` in [`supabase/migrations/0005_assignments.sql`](../supabase/migrations/0005_assignments.sql),
[`web/src/lib/assignments.js`](../web/src/lib/assignments.js)

### C2 — Focus practice on an assignment ✅
**As a** student, **I want** to drill a specific assigned situation, **so that** I can target a
weakness instead of random hands.

**Acceptance criteria**
- "Practice" on an assignment restricts the generator to that one situation; a focus banner
  with "clear" returns me to random practice.
- The button reflects state ("Practice" ↔ "Practicing").

**Implemented by** — `filter`/`only` wiring in
[`web/src/pages/StudentDashboard.jsx`](../web/src/pages/StudentDashboard.jsx) →
[`web/src/practice/BidPractice.jsx`](../web/src/practice/BidPractice.jsx) →
`nextProblem(only)` in [`web/src/practice/generate.js`](../web/src/practice/generate.js)

### C3 — Honest assignment progress ✅
**As a** student, **I want** assignment progress to count only correct attempts made after the
assignment was set, **so that** the target reflects new work.

**Acceptance criteria**
- Progress joins my attempts to the assignment on `deal_id = situation` **and**
  `created_at >= assignment.created_at`.
- "solved" counts conformant attempts; "done" counts all attempts in that situation since the
  assignment.

**Implemented by** — `student_assignments()` / `coach_assignments()` in
[`supabase/migrations/0005_assignments.sql`](../supabase/migrations/0005_assignments.sql)

---

## Epic D — Coach: Roster & Monitoring

### D1 — See my roster at a glance ✅
**As a** coach, **I want** a list of my students with their totals and last activity, **so that** I
can see who's practising and who's stalled.

**Acceptance criteria**
- The dashboard lists each linked student with "Correct: solved/total" and last-active date
  (or "No activity yet").
- The roster is produced by a single server-side RPC, hard-scoped to the calling coach — a
  coach can never see another coach's roster.

**Implemented by** — [`web/src/pages/CoachDashboard.jsx`](../web/src/pages/CoachDashboard.jsx),
`coach_roster()` in [`supabase/migrations/0004_coach_roster.sql`](../supabase/migrations/0004_coach_roster.sql),
[`web/src/lib/coach.js`](../web/src/lib/coach.js)

### D2 — Drill into a student's recent attempts ✅
**As a** coach, **I want** to expand a student and see their recent attempts, **so that** I can
spot patterns in their mistakes.

**Acceptance criteria**
- Expanding a student lists recent attempts with a ✓/✗, the situation, the student's call, and
  (on a miss) the expected call, plus the date.
- Attempts load lazily on first expand and are cached for the session.

**Implemented by** — `toggle`/attempt rows in
[`web/src/pages/CoachDashboard.jsx`](../web/src/pages/CoachDashboard.jsx),
`fetchStudentAttempts` in [`web/src/lib/coach.js`](../web/src/lib/coach.js)

### D3 — Only my own students ✅
**As a** coach, **I want** to be limited to my own students' data, **so that** the roster stays
private and authoritative.

**Acceptance criteria**
- Reading another coach's student attempts is blocked by RLS (`private.coaches_student`).
- The roster RPC and the attempts policy both gate on the coach↔student link.

**Implemented by** — attempts policy in
[`supabase/migrations/0003_attempts.sql`](../supabase/migrations/0003_attempts.sql),
helpers in [`supabase/migrations/0002_private_helpers.sql`](../supabase/migrations/0002_private_helpers.sql)

---

## Epic E — Coach: Assignments

### E1 — Assign a situation and target ✅
**As a** coach, **I want** to assign a student a specific situation with a target number, **so
that** I can direct their practice.

**Acceptance criteria**
- From a student's expanded row I pick a situation and a target (1–100, default 10) and assign it.
- The new assignment appears immediately in that student's list.

**Implemented by** — `assign`/form in
[`web/src/pages/CoachDashboard.jsx`](../web/src/pages/CoachDashboard.jsx),
`createAssignment` in [`web/src/lib/assignments.js`](../web/src/lib/assignments.js),
[`supabase/migrations/0005_assignments.sql`](../supabase/migrations/0005_assignments.sql)

### E2 — Track assignment completion ✅
**As a** coach, **I want** to see each assignment's progress against its target, **so that** I know
when a student has met the goal.

**Acceptance criteria**
- Each assignment shows "Done: solved/target", computed server-side from the student's attempts
  since the assignment date.

**Implemented by** — `coach_assignments()` in
[`supabase/migrations/0005_assignments.sql`](../supabase/migrations/0005_assignments.sql)

### E3 — Remove an assignment ✅
**As a** coach, **I want** to remove an assignment I set, **so that** I can retire goals that are
done or no longer relevant.

**Implemented by** — `removeAssignment` /
[`web/src/pages/CoachDashboard.jsx`](../web/src/pages/CoachDashboard.jsx),
`deleteAssignment` in [`web/src/lib/assignments.js`](../web/src/lib/assignments.js)

### E4 — Can only assign to my own students ✅
**As the** platform, **I want** to reject assignments to students a coach doesn't coach, **so
that** the roster boundary holds.

**Acceptance criteria**
- Insert is allowed only when `coach_id = auth.uid()` **and** the caller actually coaches the
  student (`private.coaches_student`).

**Implemented by** — `assignments_insert` policy in
[`supabase/migrations/0005_assignments.sql`](../supabase/migrations/0005_assignments.sql)

---

## Epic F — Superadmin: User & Role Management

### F1 — List all users ✅
**As a** superadmin, **I want** to see every user with email, name, and role, **so that** I can
administer the club.

**Implemented by** — [`web/src/pages/SuperadminDashboard.jsx`](../web/src/pages/SuperadminDashboard.jsx),
`admin_users()` in [`supabase/migrations/0006_admin.sql`](../supabase/migrations/0006_admin.sql),
[`web/src/lib/admin.js`](../web/src/lib/admin.js)

### F2 — Change a user's role ✅
**As a** superadmin, **I want** to promote/demote users between superadmin / coach / student,
**so that** I can grant the right capabilities.

**Acceptance criteria**
- A per-user dropdown changes the role immediately.
- The role value is validated server-side; an invalid value is rejected.
- I cannot demote my own superadmin role (guard prevents locking the club out).

**Implemented by** — `admin_set_role()` in
[`supabase/migrations/0006_admin.sql`](../supabase/migrations/0006_admin.sql)

### F3 — View coach↔student links ✅
**As a** superadmin, **I want** to see all coach→student links, **so that** I can audit the roster.

**Implemented by** — `admin_links()` in
[`supabase/migrations/0006_admin.sql`](../supabase/migrations/0006_admin.sql)

### F4 — Create & remove coach↔student links ✅
**As a** superadmin, **I want** to link and unlink a coach and a student, **so that** I keep the
roster authoritative during the pilot.

**Acceptance criteria**
- I pick a coach and a student and add the link; duplicates are ignored; a coach can't be linked
  to themselves.
- I can remove any link.
- Every admin RPC refuses non-superadmin callers (raises `forbidden`).

**Implemented by** — `admin_link()` / `admin_unlink()` in
[`supabase/migrations/0006_admin.sql`](../supabase/migrations/0006_admin.sql),
[`web/src/pages/SuperadminDashboard.jsx`](../web/src/pages/SuperadminDashboard.jsx)

---

## Epic G — Engine: System-as-data Bidding

### G1 — One bidding system encoded as data ✅
**As the** product, **I want** the bidding system stored once as data (not code), **so that** the
bot, the grader, and the explanations can never disagree, and a coach can retune it.

**Acceptance criteria**
- `natural-v1.yaml` holds ~46 situations and ~352 priority-ordered rules; only the `conditions`
  block is executable, "first match wins".
- All three live endpoints read this one file through one module — no bridge logic is duplicated.
- The data contract is documented.

**Implemented by** — [`engine/system/natural-v1.yaml`](../engine/system/natural-v1.yaml),
[`engine/app/bidder.py`](../engine/app/bidder.py),
[`engine/system/schema.md`](../engine/system/schema.md)

### G2 — `/bid` — the system bot ✅
**As a** consumer, **I want** to ask "what does the system bid with this hand here?", **so that** I
can show or check the answer.

**Implemented by** — [`engine/app/routers/bid.py`](../engine/app/routers/bid.py),
`decide()` in [`engine/app/bidder.py`](../engine/app/bidder.py)

### G3 — `/conformance` — grade a call ✅
**As a** consumer, **I want** to grade a student's call against the system's call, **so that** the
UI can show correct/incorrect with the expected call and meaning.

**Implemented by** — [`engine/app/routers/conformance.py`](../engine/app/routers/conformance.py),
`conformance()` in [`engine/app/bidder.py`](../engine/app/bidder.py)

### G4 — `/explain` — meaning & what a call promises ✅
**As a** consumer, **I want** to ask what a given call means/promises in an auction, **so that** I
can narrate it without re-deriving bridge logic.

**Acceptance criteria**
- Returns the call's `meaning` and `promised` from the data, or flags the call as undefined for
  that situation.
- The distinction between `conditions` (why *this* hand bids it) and `promised` (what *partner*
  may infer) is preserved — explanations grade against what the bidding promised.

**Implemented by** — [`engine/app/routers/explain.py`](../engine/app/routers/explain.py),
`explain_call()` in [`engine/app/bidder.py`](../engine/app/bidder.py)

### G5 — `/assess` — double-dummy result grading 🟡 (stub)
**As a** future consumer, **I want** to assess a played deal against the double-dummy optimum,
**so that** declarer/defence practice can be graded too.

**Acceptance criteria (current)**
- Endpoint and request/response contract exist but return **HTTP 501** pending the DDS spike.

**Implemented by** — [`engine/app/routers/assess.py`](../engine/app/routers/assess.py)
(schemas in [`engine/app/schemas.py`](../engine/app/schemas.py))

### G6 — Engine can't silently drift from the validated data ✅
**As a** maintainer, **I want** an automated guard that the runtime bidder still reproduces the
signed-off reference results, **so that** edits to the data or evaluator can't regress unnoticed.

**Acceptance criteria**
- A parity test re-runs the reference spike's validated cases (131) through the runtime bidder and
  fails on any mismatch.

**Implemented by** — [`engine/tests/test_parity.py`](../engine/tests/test_parity.py),
[`engine/system/evaluate_spike.py`](../engine/system/evaluate_spike.py)

### G7 — Tunable & extensible to other systems ⚪
**As a** coach/maintainer, **I want** to retune knobs (NT range, weak-two rules, rule-of-20) and
later drop in a second system (e.g. Precision) in the same shape, **so that** the platform isn't
locked to one fixed style.

**Acceptance criteria (current)**
- `toggles` exist in the data and `system_id` is parameterised throughout the API; second
  systems and coach-facing tuning UI are not yet built.

**Implemented by (foundation)** — `toggles` in
[`engine/system/natural-v1.yaml`](../engine/system/natural-v1.yaml),
`load_system(system_id)` in [`engine/app/bidder.py`](../engine/app/bidder.py)

---

## Epic H — Platform & Non-functional

### H1 — Data isolation via Row-Level Security ✅
**As a** user, **I want** the database itself to enforce who sees what, **so that** my data is safe
even if the UI has a bug.

**Acceptance criteria**
- Students read/write only their own profile and attempts; coaches additionally read their linked
  students; superadmin sees all.
- A user may update their own profile but **cannot** change their own `role` or `club_id`.
- Writes to the roster (coach↔student) are superadmin-only.

**Implemented by** — policies in
[`0001_foundations.sql`](../supabase/migrations/0001_foundations.sql),
[`0002_private_helpers.sql`](../supabase/migrations/0002_private_helpers.sql),
[`0003_attempts.sql`](../supabase/migrations/0003_attempts.sql),
[`0005_assignments.sql`](../supabase/migrations/0005_assignments.sql);
verification helper [`supabase/verify_rls.sql`](../supabase/verify_rls.sql)

### H2 — Security-hardened helper functions ✅
**As a** maintainer, **I want** the `SECURITY DEFINER` role-check helpers kept out of the
API-exposed schema, **so that** they aren't reachable as REST RPCs (Supabase advisor 0028/0029).

**Acceptance criteria**
- Helpers live in a `private` schema and are still `SECURITY DEFINER` (needed to avoid RLS
  recursion); the old `public` copies are dropped.

**Implemented by** — [`supabase/migrations/0002_private_helpers.sql`](../supabase/migrations/0002_private_helpers.sql)

### H3 — Stateless engine, single source of persistence ✅
**As an** operator, **I want** the engine to hold no state, **so that** it scales and redeploys
freely while all data lives in Supabase.

**Implemented by** — [`engine/app/main.py`](../engine/app/main.py) (no DB; compute only),
[`engine/README.md`](../engine/README.md)

### H4 — Configurable CORS for the engine ✅
**As an** operator, **I want** to lock the engine's allowed origins before the pilot, **so that**
only the web app can call it.

**Acceptance criteria**
- `ENGINE_ALLOWED_ORIGINS` (comma-separated) controls allowed origins; defaults to `*` for local
  dev and must be set to the web origin on Railway.

**Implemented by** — CORS setup in [`engine/app/main.py`](../engine/app/main.py)

### H5 — Deployable as three homes ✅
**As an** operator, **I want** a clear deployment path, **so that** web, engine, and database each
live where they fit.

**Acceptance criteria**
- Web → Vercel (Vite, `web/` root, SPA fallback so deep links don't 404); engine → Railway
  (Docker); Postgres/Auth → Supabase (EU region).
- A runbook documents the steps and the magic-link redirect-URL gotcha.

**Implemented by** — [`DEPLOY.md`](../DEPLOY.md),
[`web/vercel.json`](../web/vercel.json), [`engine/Dockerfile`](../engine/Dockerfile)

### H6 — EU data residency (GDPR) ✅
**As the** club, **I want** data stored in the EU, **so that** we meet GDPR expectations for the
pilot.

**Implemented by** — Supabase EU-region requirement documented in
[`README.md`](../README.md) / [`DEPLOY.md`](../DEPLOY.md)

---

## Backlog / Future (named in docs, not yet built)

These are explicitly anticipated by the code and docs — captured here so they aren't lost.

- ⚪ **`/assess` double-dummy** result grading (declarer/defence practice). — `assess.py`, `schema.md`
- ✅ **Opener-rebid tree** after a suit response — _done 2026-06-09:_ the **1-over-1** responses
  (six `opener-rebid-1x-1y`), the **1NT response** (`opener-rebid-1{c,d,h,s}-1nt`), the
  **game-try decision** after a simple major raise (`opener-rebid-1h-2h` / `1s-2s`), and the
  **2/1 game-forcing** responses (`opener-rebid-1{h,s}-2{c,d}`, `1s-2h`, `1d-2c`). All eighteen
  are vetted gap-free and in the practice pool. — `engine/system/schema.md`
- ⚪ **Complete the competitive matrix** (responder-after-interference / negative doubles across
  all opening×overcall pairs); currently representative. — `engine/system/schema.md`
- ✅ **Re-enable minor-suit (1♣/1♦) and 1NT responses** in practice — _done 2026-06-09._ The
  `resp-1c` / `resp-1d` / `resp-1nt` rule gaps (strong no-major hands and weak long-minor hands)
  were closed with catch-all rules; all three are back in the vetted pool. — `web/src/practice/generate.js`
- ⚪ **Coach-tunable toggles UI** and a **second bidding system** (e.g. Precision) in the same
  data shape. — `engine/system/schema.md`, `natural-v1.yaml`
- ⚪ **Multi-club / scoped roles** — `clubs` table and `club_id` exist; the flat one-role model is
  a deliberate pilot simplification to revisit later. — `README.md`,
  `supabase/migrations/0001_foundations.sql`

---

## Traceability summary

| Epic | Stories | Primary code |
|------|---------|--------------|
| A — Auth & onboarding | A1–A6 | `web/src/auth/*`, `App.jsx`, `i18n/*`, migration 0001/0002 |
| B — Student practice | B1–B10 | `web/src/practice/*`, `lib/engine.js`, `lib/attempts.js`, engine routers |
| C — Student assignments | C1–C3 | `StudentDashboard.jsx`, `lib/assignments.js`, migration 0005 |
| D — Coach monitoring | D1–D3 | `CoachDashboard.jsx`, `lib/coach.js`, migration 0003/0004 |
| E — Coach assignments | E1–E4 | `CoachDashboard.jsx`, `lib/assignments.js`, migration 0005 |
| F — Superadmin | F1–F4 | `SuperadminDashboard.jsx`, `lib/admin.js`, migration 0006 |
| G — Engine | G1–G7 | `engine/app/*`, `engine/system/*`, `tests/test_parity.py` |
| H — Platform | H1–H6 | migrations 0001–0003/0005, `engine/app/main.py`, `DEPLOY.md` |
