# Link a Coach from Settings — User Story

_Follow-up to [`new-user-onboarding.md`](./new-user-onboarding.md): removing the
coach/club-code step from onboarding leaves self-registered students with no way to
connect to a coach. This restores that path in Settings._

**Persona** — **Student** (typically self-registered, not yet linked to a coach).

---

## C1 — Link to a coach with an invite code ✅ _(2026-06-15)_
**As a** student, **I want** to enter my coach's invite code in Settings, **so that** my
coach can see my progress and assign me practice.

**Acceptance criteria**
- Settings has a **Coach** section.
- **Not linked yet:** an input for the code + a **Link** button. On submit it calls the
  existing `redeem_coach_code` RPC; on success it shows the coach's name and a success
  message; on failure it shows the mapped error (`invalid code` / `cannot link to yourself`).
- **Already linked:** the section shows the linked coach's display name instead of the input.
- The code is case-/space-insensitive (the RPC already `upper(btrim(...))`s it).
- Strings are translated (en + lv, key-for-key parity).

**Implemented by** — `Coach` section in
[`web/src/components/SettingsDialog.jsx`](../../web/src/components/SettingsDialog.jsx) ⚪,
reusing `redeemCoachCode` in [`web/src/lib/onboarding.js`](../../web/src/lib/onboarding.js) ✅
(RPC from [migration 0010](../../supabase/migrations/0010_signup_onboarding.sql) ✅).

**Resolved — reading the current link.** Shipped as the `my_coach()` `SECURITY DEFINER`
RPC (migration 0015), scoped to `student_id = auth.uid()`, so roster RLS stays
superadmin-only. _Note:_ a student may have more than one coach row; `my_coach()` returns
the earliest (`order by created_at limit 1`) — multi-coach display is out of scope.

**Out of scope (note for later):** unlinking / switching coach; coaches sharing their code
from the coach dashboard (separate story).
