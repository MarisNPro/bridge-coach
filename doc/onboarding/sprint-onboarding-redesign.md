# Sprint — Onboarding redesign + link-a-coach

_Plan to deliver [`new-user-onboarding.md`](./new-user-onboarding.md) and
[`link-coach-from-settings.md`](./link-coach-from-settings.md). Kept deliberately small:
five vertical slices, each its own shippable PR behind the existing CI._

## Sprint goal

> A new user can sign up on a **single screen** (email or Google), and any student can
> **link to a coach from Settings**.

## Definition of Done (every item)

- Acceptance criteria of the referenced story met.
- Tests added/updated and green; CI (pytest + web test/build) passes on the PR.
- i18n en/lv key-for-key parity held for any new strings.
- Merged to `main` and verified on the deployed app.
- The story file's statuses flipped (⚪/🟡 → ✅) as parts land.

## Sprint backlog (in order)

### SB-1 — DB foundation for pre-auth profile data  · _S_  ✅ _done 2026-06-15_
**Story:** O2, O3, O4 (data). **Depends on:** —
Migration [`0011`](../../supabase/migrations/0011_onboarding_metadata.sql): adds
`profiles.full_name`; extends `private.handle_new_user()` to read `full_name`
(Google `full_name`/`name`) from sign-up metadata and stamp `terms_accepted_at` when
metadata carries `terms_accepted=true`. Idempotent, append-only (mirrors 0010).
- ✅ Wrote + applied 0011 via Supabase MCP; verified the column exists and the trigger
  reads `full_name` + `terms_accepted`; security advisor clean (no new warnings).
- Done when: a `signInWithOtp` with `data:{display_name,full_name,skill_level,terms_accepted}`
  yields a fully-populated profile on first sign-in. _(End-to-end exercised in SB-2.)_

### SB-2 — One-screen sign-up (capture before auth)  · _M_  ✅ _email path done 2026-06-15_
**Story:** O1, O2, O3, O4, O5. **Depends on:** SB-1
> ✅ **Done:** sign-up/sign-in two-mode login screen; nickname + experience + required
> empty Terms checkbox (links to /terms /privacy); email → `signInWithOtp` with
> `{display_name, skill_level, terms_accepted, locale}` metadata; sign-in mode uses
> `shouldCreateUser:false`. Migration `0012` stamps `onboarded_at` on metadata sign-up so
> the legacy wizard is skipped. +4 Login tests; i18n en/lv parity (233 keys).
> ◑ **Deferred (Google is gated off):** answers are stashed (`stashPendingOnboarding`) but
> the **apply-on-return** after OAuth isn't wired yet — do it when `VITE_ENABLE_GOOGLE_AUTH`
> is turned on (can fold into SB-4 routing).
_(original scope below)_
Rework the login screen into sign-up: nickname + experience + the single required
empty Terms/Privacy checkbox, alongside email / Continue-with-Google.
- Email → `signInWithOtp({ email, options:{ data } })` → "check your email".
- Google → `signInWithOAuth` (real name captured by the trigger via metadata/identity).
- Block **Agree & continue** until the checkbox is ticked; links open `/terms` `/privacy`
  in a new tab.
- Tasks: UI + validation; wire metadata; i18n; component tests (blocks until consent;
  email sends metadata; Google path).
- Done when: a new email/Google user is created with the right profile fields, no
  separate wizard visited.

### SB-3 — Welcome screen  · _S→M_
**Story:** O6. **Depends on:** SB-1 (adds `welcomed_at`)
New `web/src/auth/Welcome.jsx` + `/welcome` route; shown once after first entry, gated by
a `profiles.welcomed_at` flag (set on view); continue → role dashboard.
- Tasks: `welcomed_at` (fold into 0011 or a tiny 0012); route + screen; routing sends
  freshly-onboarded users here once; i18n; a routing test.

### SB-4 — Retire the post-auth wizard  · _S_
**Story:** O1, O7 (cleanup). **Depends on:** SB-2, SB-3
Remove the `/onboarding` route + `Onboarding.jsx` (now redundant); simplify
`needsOnboarding`/`Home` so a complete profile routes straight to `/welcome` (first time)
or the dashboard. Drop now-unused onboarding i18n keys (keep parity).
- Done when: no dead route remains and returning users land on their dashboard directly.

### SB-5 — Link a coach from Settings  · _M_  _(parallelizable)_
**Story:** C1. **Depends on:** — (independent of SB-1…4)
Coach section in `SettingsDialog.jsx`: enter code → `redeemCoachCode`; show linked coach
when present. Add a `SECURITY DEFINER` `my_coach()` RPC (in 0011/0012) to read the current
link without widening roster RLS.
- Tasks: RPC + grants; Settings UI (input/link, linked-state, error mapping); i18n;
  component test (link success, invalid code, already-linked).

## Sequencing

```
SB-1 ──▶ SB-2 ──▶ SB-4
   └───▶ SB-3 ──▶ SB-4
SB-5 (any time, independent)
```
Critical path: SB-1 → SB-2 → SB-4. SB-5 can run in parallel from day one (RPC + RLS may
share migration 0011 with SB-1).

## Out of scope (backlog, not this sprint)

- Real age **verification** (still a self-declared checkbox).
- Unlinking / switching coach; coaches sharing their code from the coach dashboard.
- Latvian copy for the consent sentence itself (tracked separately).
- Real legal content / dropping the "Draft for review" banner.

## Risks & mitigations

- **Pre-auth answers lost across devices** → carried as sign-up metadata (SB-1), so they
  attach at account creation regardless of where the link is opened.
- **No coach link during the gap** between removing the onboarding step and shipping SB-5
  → SB-5 is independent and should land in the same sprint; sequence it early if at risk.
- **RLS over-widening** for reading the coach link → use the `my_coach()` definer RPC, not
  a broadened table policy.
