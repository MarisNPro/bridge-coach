# New-User Onboarding — User Story

_Target flow for first-time sign-up. This is a **redesign** of the onboarding wizard
described in [`../user-stories.md`](../user-stories.md) Epic A — it collects the
profile details **before** authentication and sends the magic link only after the
user agrees. Companion to the auth stories A1–A6._

| Status | Meaning |
|--------|---------|
| ✅ | Implemented and wired end-to-end |
| 🟡 | Partly implemented today; needs change for this flow |
| ⚪ | Planned — not yet built |

**Persona** — **New user**: a prospective student who does not yet have an account.

---

## Flow at a glance (the target)

```
Sign-up screen
  ├─ choose:  ▸ email address      ▸ Continue with Google (captures real name)
  ├─ enter:   nickname · experience level
  ├─ tick:    ☐ I am 13+ and accept the Terms and Privacy Policy   (starts empty, required)
  └─ press "Agree & continue":
        • Google  → already authenticated → Welcome screen
        • Email   → magic link sent (carrying the answers) → user clicks link → Welcome screen
```

The defining change from today: **all profile answers are gathered on the sign-up
screen, up front.** There is no separate post-auth wizard route. For email, the
answers ride on the magic link as sign-up metadata, so they attach to the account on
first sign-in regardless of which device opens the link.

---

## O1 — Choose how to sign up ⚪
**As a** new user, **I want** to start sign-up with either my email or Google, **so that**
I can use whichever I prefer.

**Acceptance criteria**
- The sign-up screen offers an **email** field and a **Continue with Google** button.
- Google sign-up captures the user's **real name** from the Google profile (stored, not
  shown as the public nickname — see O5).
- Google availability is gated by `VITE_ENABLE_GOOGLE_AUTH` until provider creds are set.

**Implemented by (today / to change)** — [`web/src/auth/Login.jsx`](../../web/src/auth/Login.jsx) 🟡
(today it only authenticates; it must also gather the O2/O3 fields before continuing).

## O2 — Provide profile details ⚪
**As a** new user, **I want** to set my nickname and self-rated experience level, **so that**
the app greets me correctly and pitches practice at my level.

**Acceptance criteria**
- **Nickname** — free text; this is the public display name. Starts **blank** (even for
  Google users — the Google real name is stored separately, not used as the nickname).
- **Experience level** — one of `beginner / improving / intermediate / advanced`.
- Both are captured **before** the magic link is sent (email) or before landing on the
  welcome screen (Google).

**Data** — nickname → `profiles.display_name`; experience → `profiles.skill_level`
(both already supported by the `handle_new_user` trigger reading sign-up metadata,
migration 0010). Google real name → a **new** `profiles.full_name` column. ⚪

## O3 — Accept Terms & Privacy (required) ⚪
**As the** platform, **I want** the user to actively accept the Terms and Privacy Policy
before an account is created, **so that** consent is recorded at sign-up.

**Acceptance criteria**
- A **single checkbox** — "I am 13 or older and accept the Terms and Privacy Policy" —
  that **starts empty** and must be ticked to proceed (the **Agree & continue** action
  is blocked otherwise, with an inline message).
- "Terms" and "Privacy Policy" link to [`/terms`](../../web/src/pages/Legal.jsx) and
  [`/privacy`](../../web/src/pages/Legal.jsx) (open in a new tab so sign-up isn't lost). ✅
- Acceptance is timestamped on the profile (`terms_accepted_at`) — set at account
  creation, not in a later step.

## O4 — Email path: the magic link carries the answers ⚪
**As a** new user signing up by email, **I want** to enter everything once and just click
the link, **so that** I don't re-type anything after confirming my email.

**Acceptance criteria**
- Pressing **Agree & continue** calls `signInWithOtp({ email, options: { data: { display_name, skill_level, terms_accepted, locale } } })`
  and shows a "check your email" confirmation.
- The answers travel as sign-up **metadata**, so `handle_new_user` writes them to the
  profile on first sign-in — **even if the link is opened on a different device**.
- Clicking the link returns the user signed-in and onboarded → **Welcome screen** (O6).

**Implemented by (to change)** — `signInWithOtp` call in
[`web/src/auth/Login.jsx`](../../web/src/auth/Login.jsx); metadata read in
`private.handle_new_user()` ([migration 0010](../../supabase/migrations/0010_signup_onboarding.sql)) 🟡
(extend to also set `terms_accepted_at` from metadata).

## O5 — Google path: real name captured, nickname chosen ⚪
**As a** new user signing up with Google, **I want** to be signed in immediately after
agreeing, **so that** I reach the app without an email round-trip.

**Acceptance criteria**
- Google returns the **real name**, stored on the profile (`full_name`); the public
  **nickname** is still the one the user typed in O2 (not auto-set from Google).
- After **Agree & continue**, the user is authenticated and sent straight to the
  **Welcome screen** (O6) — no magic link.

## O6 — Welcome screen on first entry ⚪
**As a** newly onboarded user, **I want** a short welcome screen the first time I arrive,
**so that** I get oriented before the dashboard.

**Acceptance criteria**
- Shown **once**, right after onboarding completes (email link click or Google return).
- Briefly welcomes the user by nickname and points them to their first action
  (e.g. start practising); continuing lands them on their role dashboard.
- Not shown again on later sign-ins (gated by a `welcomed_at` flag or equivalent). ⚪

**Implemented by** — new `web/src/auth/Welcome.jsx` + a `/welcome` route in
[`web/src/App.jsx`](../../web/src/App.jsx). ⚪

## O7 — Returning users sign in only ✅/🟡
**As a** returning user, **I want** to sign in without redoing onboarding, **so that** I get
straight back to the app.

**Acceptance criteria**
- A returning email/Google sign-in skips O2–O6 entirely (profile already `onboarded_at`).
- Routing sends them to their role dashboard. ✅ (today's `needsOnboarding`/`Home` logic
  in [`AuthProvider.jsx`](../../web/src/auth/AuthProvider.jsx) already does this.)

---

## Deltas from the current build (what changes)

The current flow (Epic A, A2): **authenticate first → 4-step post-auth wizard**
([`web/src/auth/Onboarding.jsx`](../../web/src/auth/Onboarding.jsx)) collecting name +
language, skill, an **optional coach/club code**, then consent.

To reach the target:
1. **Move the questions onto the sign-up screen** (pre-auth) and retire the separate
   `/onboarding` wizard route — the profile is fully populated at account creation.
2. **Email metadata** — pass `display_name`, `skill_level`, `locale`, `terms_accepted`
   via `signInWithOtp({ options: { data } })`; have `handle_new_user` also stamp
   `terms_accepted_at` from metadata.
3. **Add `profiles.full_name`** for the Google real name (nickname stays `display_name`).
4. **Remove the coach/club code step** from onboarding — linking to a coach moves to a
   later action (e.g. Settings); the `redeem_coach_code` RPC is unchanged.
5. **Add the Welcome screen** (`/welcome`) shown once after first entry.

**Out of scope / unchanged:** the `redeem_coach_code` / `coach_invite_code` RPCs; RLS
(role and `club_id` stay non-user-writable); returning-user sign-in. Age remains a
**self-declared checkbox, not verified** (existing backlog note in the Privacy Policy).
