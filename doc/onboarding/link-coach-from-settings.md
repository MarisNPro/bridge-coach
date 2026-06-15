# Link a Coach from Settings — User Story

_Follow-up to [`new-user-onboarding.md`](./new-user-onboarding.md): removing the
coach/club-code step from onboarding leaves self-registered students with no way to
connect to a coach. This restores that path in Settings._

**Persona** — **Student** (typically self-registered, not yet linked to a coach).

---

## C1 — Link to a coach with an invite code ⚪
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

**Open item — reading the current link.** Showing "already linked to X" needs the student
to read their own `coach_students` row + the coach's name. Today the roster RLS is
superadmin-only, so this needs **either** a narrow SELECT policy (student may read rows
where `student_id = auth.uid()`) **or** a small `SECURITY DEFINER` `my_coach()` RPC. The
RPC mirrors the 0010 pattern and avoids widening table RLS — **preferred**.

**Out of scope (note for later):** unlinking / switching coach; coaches sharing their code
from the coach dashboard (separate story).
