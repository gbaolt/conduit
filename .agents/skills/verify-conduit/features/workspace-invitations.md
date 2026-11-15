# Workspace members and invitations

An owner or admin sees the workspace's members in Settings and invites people by email. Each invitation shows as pending until the invitee joins or it expires after 7 days.

## Sub-features

- `members-table` lists members with their role, status, and join date. The viewer's own row reads `(you)`.
- `invite` sends invitations to one or more comma-separated emails, as `Member` or another role from `Invite as`.
- `pending` lists open invitations under `Pending invitations`, each with a `Revoke` button.
- `join-link` copies a join link with `Copy join link`.

## How to get to it (user POV)

- Go to `/settings`. For an owner or admin, it redirects to `/settings/members`.
- On `/settings/members` or `/settings/invitations`, choose `Invite people`.

## Driving it with drive.py

Preconditions:

- A signed-in account that owns its workspace, from the `account` journey.

- **Members.** Run `drive.py run --reuse invite`. It opens `/settings`, which lands on `/settings/members`, where the table `Workspace members` holds the account's row with `owner`.
- **Invite.** It chooses `Invite people`, which opens the dialog `Invite people to <workspace>`. It fills the textbox `Email addresses` with `delivered+invitee<ts>@resend.dev` and chooses `Send invitations`. The dialog's `status` reads `Sent 1 invitation to <email>.`
- **Pending.** On `/settings/invitations`, the table `Pending invitations` has a row containing the invitee's email, with a `Revoke invitation for <email>` button.
- **Proof.** The screenshots are `members page`, `invite dialog filled`, `invitation sent`, and `pending invitation listed`.

## Gotchas

- `Send invitations` and `Copy join link` stay disabled until the textbox holds a valid email.
- Inviting sends a real email through Resend. Keep to `@resend.dev` addresses.
- The admin settings pages send plain members home, so an account that is not an owner or admin never reaches them.
- The settings layout has two `main` elements. Use `get_by_role("main").last` for the page content.
