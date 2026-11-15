# Account and onboarding

A new user creates an email-and-password account, verifies their email with a 6-digit code, signs in, and creates a workspace. The workspace opens on its default channel, `#all-<workspace-slug>`.

## Sub-features

- `signup` creates an account and moves to `/verify-email?email=...&type=email-verification`.
- `verify` accepts the emailed code. The driver substitutes a dev-database write for it, because no inbox is reachable.
- `signin` sends a verified user with no workspace to `/onboarding`, showing "Signed in as <email>".
- `signin-unverified` opens the "Verify your email first" dialog for an unverified account.
- `create-workspace` creates a workspace and should open its default channel.
- `pick-workspace` opens an existing workspace from "Choose a workspace".

## How to get to it (user POV)

- Go to `/sign-up`, fill in the form, and choose "Create account".
- Go to `/sign-in` and choose "Sign in". "Forgot password?" leads to `/forgot-password`.
- On `/onboarding`, choose "Create a workspace", or a listed workspace under "Your workspaces".
- "Continue with Google" and "Continue with GitHub" need real OAuth accounts, so they are out of scope.

## Driving it with drive.py

Preconditions:

- `drive.py doctor` passes.

- **Sign up.** Run `drive.py run account`. It fills the textboxes `Name`, `Email`, `Password` (exact), and `Confirm your password`, then checks the checkbox named `I agree to all Terms...` and chooses the button `Create account`. The URL becomes `/verify-email?...`.
- **Verify.** The journey runs `scripts/mark-verified.mts <email>`, which prints `verified <email>`.
- **Sign in.** It fills `Email` and `Password` and chooses `Sign in`. The URL becomes `/onboarding`, and the text `Signed in as <email>` is visible.
- **Create workspace.** It chooses the button `Create a workspace`, fills `Name` (the URL slug fills itself), and chooses `Create workspace`. Expected result: the level-1 heading `all-<slug>` and the textbox `Message #all-<slug>`.
- **Pick workspace.** On "Choose a workspace", it chooses the button whose name starts with the workspace name. The default channel opens.
- **Proof.** The screenshots are `sign-up form filled`, `verify-email page after sign-up`, `onboarding after sign-in`, `create workspace form`, and `after create workspace`. `.verify/account.json` records the email and workspace.

## Gotchas

- Known failing as of commit `33f62cf`: after sign-in, `Create workspace` lands on "Choose a workspace" instead of opening the new workspace. A full page load of `/` then opens it, so the client router probably reuses the `/` → `/onboarding` redirect it cached at sign-in (a guess, not confirmed). The journey records this as FAIL, recovers through the picker, and goes on. Delete this note once the app is fixed and the check passes.
- Seen as of commit `33f62cf`: right after sign-in, the client requests `/channels`, `/dms`, `/channel-sections`, `/workspace-settings`, and `/notification-settings` and gets 403s, plus 400s from `/auth/organization/get-active-member-role`, before the active workspace is set. The report's "Browser console errors" section lists them. They don't fail a journey.
- The terms control is a custom `role=checkbox` span next to a hidden `<input>`, so `get_by_label` matches two elements. Use `get_by_role("checkbox", ...)`.
- Sign-up sends a real verification email through Resend, so keep to `@resend.dev` addresses.
- The workspace slug is derived from the name, so a reused name fails with `SLUG_TAKEN`. The journey adds a timestamp.
