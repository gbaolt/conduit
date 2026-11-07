# M0 workspace admin plan

M0 lets a workspace grow past one person and lets its admins run it from the UI. Today the server sends invitation emails, but nothing in the app creates an invitation, and the email links to `/accept-invitation`, a route that does not exist. This plan ships the nine M0 rows in [`PRD.md`](../../PRD.md#m0-workspace-admin) as four PRs against `staging`.

The rule the milestone enforces is that one shared table, `workspacePolicy`, decides every admin action. The client reads it to hide controls. The server reads it to refuse requests.

| PR  | Ships                                     | PRD rows         | Depends on |
| --- | ----------------------------------------- | ---------------- | ---------- |
| PR1 | Settings shell and member management      | M0.4, M0.5, M0.6 | None       |
| PR2 | Email invitations and the accept page     | M0.1, M0.3       | PR1        |
| PR3 | Joining without an invitation             | M0.2, M0.9       | PR2        |
| PR4 | Workspace profile and channel permissions | M0.7, M0.8       | PR1        |

The exit check passes after PR2. PR3 and PR4 are independent of each other.

## How to read this

One box is one unit of work. Check a box only when its evidence exists, such as a test run, a screenshot, or a SHA. The body is a how-to. The appendices explain and record.

Each PR runs under the poteto-mode Feature playbook and opens against `staging`. Each PR is a sequence of commits, one per **Commit** heading below. Each commit ends green on `pnpm lint`, `pnpm typecheck`, and `pnpm test`, so a reviewer can read the PR commit by commit. Each PR that changes a PRD row's status updates `PRD.md` in the same diff. Each PR that adds a migration says so in the first line of its body, per `conduit-database`.

Tests alone are not sufficient verification. A PR is verified only when its unit and live boxes are all checked. Signed-in flows need a real session, so the operator runs the signed-in live boxes. The agent runs the signed-out ones and every unit box.

## Data shapes

These shapes come first. Each PR below adds the ones it needs.

| Shape                 | Lives in                                         | Holds                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspacePolicy`     | `packages/contract/src/lib/workspace-policy.ts`  | A table from admin action to `allow(actor, target?)`, in the style of `channelPolicy`. Actions are `viewSettings`, `invite`, `revokeInvitation`, `changeRole`, `removeMember`, `deactivate`, `reactivate`, `editWorkspace`, `editPermissions`, `manageJoinLink`, `manageAllowedDomains`. |
| `WorkspaceMember`     | `packages/contract/src/schemas/organizations.ts` | `{ memberId, userId, name, email, image, role, status: 'active' \| 'deactivated', joinedAt }`                                                                                                                                                                                            |
| `WorkspaceInvitation` | same                                             | The admin's view of a pending invitation. `{ id, email, role, inviterName, expiresAt }`                                                                                                                                                                                                  |
| `MemberDeactivation`  | Prisma model, app-owned                          | `{ memberId (FK to Member, cascade), deactivatedAt, deactivatedById }`. A row means deactivated. Reactivating deletes the row. Removing the member deletes it through the cascade.                                                                                                       |
| `WorkspaceJoinLink`   | Prisma model, app-owned                          | `{ organizationId (PK), token (unique), createdById, createdAt }`. Resetting replaces the token.                                                                                                                                                                                         |
| `AllowedDomain`       | Prisma model, app-owned                          | `{ organizationId, domain }`, unique on the pair, indexed on `domain` so sign-in can find workspaces by domain.                                                                                                                                                                          |
| `WorkspaceSettings`   | Prisma model, app-owned                          | `{ organizationId, channelCreators, publicChannelCreators }`, each `'everyone' \| 'admins'`. No row means both are `'everyone'`, so no backfill.                                                                                                                                         |

`workspacePolicy` mirrors what Better Auth 1.7.1 already enforces, read from `dist/plugins/organization/routes/crud-members.mjs`. Only an owner can grant or change the owner role. The last owner cannot be demoted or removed. The client calls Better Auth's organization routes directly (`authClient.organization.listMembers` in `apps/client/src/services/workspaces/hooks.ts`), so its rules must hold there too. The policy adds the rules Better Auth lacks: deactivation, settings, the join link, and allowed domains.

## Program checklist

- [ ] Load the skills AGENTS.md names for each PR before writing code: `conduit-structure`, `orpc-contract`, `nestjs-best-practices`, `organization-best-practices`, `conduit-database` for PRs with a migration, the React skills for UI, and `next-dev-loop` before reporting a client change done.
- [ ] Follow the dependency column in the table above. PR4 can run in parallel with PR2 and PR3.
- [ ] Number migrations in merge order. PR1, PR3, and PR4 each add one. If PR4 merges before PR3, PR3 renumbers its folder to stay one past the highest.
- [ ] Ask the operator for S3 credentials and a bucket before PR4's icon commit, and ask before installing the S3 client package.

## Manage members from workspace settings (PR1, M0.4, M0.5, M0.6)

**Depends on.** None.

### Commit 1. Add the policy, the settings shell, and the members list

**Files.**

- [ ] Create `packages/contract/src/lib/workspace-policy.ts` and `workspace-policy.test.ts`.
- [ ] Edit `packages/contract/src/schemas/organizations.ts`, `contracts/organizations.ts`, and `contract.ts`. Add `WorkspaceMemberSchema` and a `members` group with `members.list`.
- [ ] Edit `apps/server/src/workspaces/domain/workspace-members.repository.ts` and its Prisma reader. Add `list(organizationId)`.
- [ ] Create `apps/server/src/workspaces/application/workspace-members.service.ts` and `presentation/workspace-members.controller.ts`. Register them in `workspaces.module.ts`.
- [ ] Create `apps/client/src/app/(dashboard)/settings/layout.tsx` and `settings/members/page.tsx`.
- [ ] Create `apps/client/src/features/workspace-settings/components/` for the settings nav and the members table.
- [ ] Edit `apps/client/src/services/workspaces/queries.ts` and `hooks.ts`.
- [ ] Edit `apps/client/src/features/workspace/components/workspace-sidebar/workspace-header.tsx`. Add **Workspace settings** to the menu for admins.

**Build.**

- [ ] `workspacePolicy` with every action from the data shapes table, and `canWorkspace(action, actorRole, target?)`. Rules that PR2 to PR4 need land here now, so the policy is reviewed once.
- [ ] `members.list` returns `WorkspaceMember[]` for the active workspace, reading `Member` and `User` through Prisma. Chain `authorized`, `arcjet.read`, `workspaceMember`.
- [ ] Move the `authClient.organization.listMembers` caller in `services/workspaces/hooks.ts` to `members.list`, then delete the old hook, so deactivated members are filtered in one place.
- [ ] The settings layout redirects a non-admin to `/`. Its nav lists only the sections that exist so far.

### Commit 2. Remove a member and change a role

**Files.**

- [ ] Edit the organizations contract, gateway, service, and controller. Add `members.remove` and `members.updateRole`.
- [ ] Edit the members table. Add a row menu.

**Build.**

- [ ] `members.updateRole` calls Better Auth `updateMemberRole`. Map `YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER` to `FORBIDDEN` and `YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER` to `LAST_OWNER` in the contract's error map.
- [ ] `members.remove` calls Better Auth `removeMember`. The existing `afterRemoveMember` hook already removes the user's channel memberships. Map the only-owner error to `LAST_OWNER`.
- [ ] The row menu offers only the actions `canWorkspace` allows for that row. Removal asks for confirmation and names the person.
- [ ] A removed user whose session still points at the workspace gets `FORBIDDEN` from `workspaceMember`. Confirm the dashboard layout sends them to `/onboarding` rather than an error screen, and fix it here if not.

### Commit 3. Deactivate and reactivate a member

**Files.**

- [ ] Add the `GLOSSARY.md` entry **Deactivated member**.
- [ ] Edit `apps/server/database/schema.prisma`. Add `MemberDeactivation`. Write the migration from a diff, per `conduit-database`.
- [ ] Edit `apps/server/src/workspaces/infrastructure/prisma-workspace-members.repository.ts`.
- [ ] Edit `apps/server/src/infrastructure/auth/auth.config.ts`.
- [ ] Edit `apps/server/src/organizations/application/organizations.service.ts`.
- [ ] Add `members.deactivate` and `members.reactivate` to the contract and the workspaces server feature.

**Build.**

- [ ] `findRole` returns `null` for a deactivated member. Every workspace-scoped oRPC procedure then refuses them through `workspaceMember`, with no other change.
- [ ] A Better Auth `hooks.before` refuses any `/organization/*` call, `set-active` included, when the session user is deactivated in the target workspace. Without it, a deactivated admin could still invite through Better Auth's routes.
- [ ] `organizations.list` drops workspaces where the caller is deactivated.
- [ ] `members.list` reports `status: 'deactivated'`. The members table shows a badge and a **Reactivate** action.
- [ ] Deactivation keeps channel memberships and the account, so reactivation restores the person's access as it was.
- [ ] Edit `PRD.md`. Mark M0.4, M0.5, and M0.6 `Shipped`, and set M0 to `In progress`.

**You see.**

- [ ] An admin opens **Workspace settings** from the header menu and sees every member with name, email, role, status, and join date. A member sees no menu item, and `/settings/members` sends them to `/`.
- [ ] An admin promotes a member to admin, then removes them. The removed user's next navigation lands on `/onboarding`.
- [ ] A deactivated user's workspace disappears from their switcher. Reactivating brings it back.

**Verify, unit.**

- [ ] `workspace-policy.test.ts` covers each action for owner, admin, and member actors, including an admin acting on an owner and an owner granting owner. Run `pnpm --filter @conduit/contract test`.
- [ ] Service tests, with `TEST_DATABASE_URL` set, cover listing members, an admin promoting a member, an admin refused when changing an owner, demoting the last owner refused with `LAST_OWNER`, removal deleting the user's `ChannelMember` rows, `findRole` returning `null` after deactivation, and removal deleting the deactivation row through the cascade. Run `pnpm --filter server test`.
- [ ] A test calls Better Auth `createInvitation` as a deactivated admin and gets `FORBIDDEN`.

**Verify, live.** Operator, signed in, with two browsers.

- [ ] The members page works at 360 px wide and in both themes, and every control is reachable by keyboard.
- [ ] Change a second user's role, deactivate them while their tab is open, reactivate them, then remove them. Each step shows on their side on the next action.

## Invite people by email (PR2, M0.1 and M0.3)

**Depends on.** PR1.

### Commit 1. Create, list, and revoke invitations

**Files.**

- [ ] Edit `packages/contract/src/contracts/organizations.ts`. Add `invitations.create`, `invitations.listForWorkspace`, `invitations.revoke`.
- [ ] Edit `apps/server/src/organizations/domain/organizations.gateway.ts`, `infrastructure/better-auth-organizations.gateway.ts`, `application/organizations.service.ts`, `presentation/organizations.controller.ts`.
- [ ] Create `apps/client/src/features/workspace-settings/components/invite-dialog.tsx` and the invitations table.
- [ ] Create `apps/client/src/app/(dashboard)/settings/invitations/page.tsx`.

**Build.**

- [ ] `invitations.create` takes `{ emails: string[] (1 to 20), role: 'member' | 'admin' }` and calls Better Auth `createInvitation` once per email. It returns which emails were sent and which were skipped as already members or already invited. Chain `arcjet.heavyWrite`, since each call sends email.
- [ ] `invitations.listForWorkspace` returns pending, unexpired `WorkspaceInvitation[]`, filtering expired rows the same way `listInvitations` does.
- [ ] `invitations.revoke` calls Better Auth `cancelInvitation`. A missing invitation maps to a `NOT_FOUND` domain error.
- [ ] The invite dialog opens from **Invite people** in the header menu and from the invitations page. It takes several emails and a role picker, and shows the per-email result.

### Commit 2. Accept from the email link

**Files.**

- [ ] Edit `apps/client/src/features/auth/lib/callback-url.ts` and add a test beside it.
- [ ] Create `apps/client/src/app/accept-invitation/page.tsx` and `apps/client/src/features/onboarding/components/accept-invitation.tsx`.
- [ ] Edit `PRD.md`. Mark M0.1 and M0.3 `Shipped`.

**Build.**

- [ ] `isSafeInternalPath` rejects a backslash anywhere in the path, so `/\evil.com` cannot redirect off the app.
- [ ] `/accept-invitation?id=` handles three states. Signed out, it sends the visitor to sign-in with `callbackURL` set back to this page, using `withCallbackURL`. Signed in as the recipient, it shows the workspace name and an **Accept** button that calls `useAcceptInvitation`, sets the workspace active, and opens `/`. Signed in as someone else, it names the invited email and offers **Sign out**.

**You see.**

- [ ] Inviting `new@example.com` logs `[auth:invite] to=new@example.com` in dev, or sends the email when Resend is configured, and the address appears under Invitations.
- [ ] Revoking removes it from the list, and the email link then shows "This invitation is no longer valid."
- [ ] The exit check. An admin invites a person, that person joins from the email, and the admin changes their role and then removes them, all from the UI.

**Verify, unit.**

- [ ] A service test creates two invitations, one for an existing member, and gets one sent and one skipped. A second test revokes one and lists none.
- [ ] `callback-url.test.ts` rejects `/\evil.com` and `//evil.com` and accepts `/accept-invitation?id=x`.
- [ ] Run `pnpm --filter server test` and `pnpm --filter client test`.

**Verify, live.**

- [ ] Agent. `/accept-invitation?id=x` signed out redirects to `/sign-in?callbackURL=...`. Drive it with `next-dev-loop`.
- [ ] Operator. Run the exit check end to end with two browsers, signing up the invited address from the email link.
- [ ] Operator. Open the link while signed in as a different user and see the wrong-account message.

## Let people join without an invitation (PR3, M0.2 and M0.9)

**Depends on.** PR2.

### Commit 1. Join with a join link

**Files.**

- [ ] Add the `GLOSSARY.md` entries **Join link** and **Allowed domain**. The glossary tells writers to avoid "invite link" for an invitation, and a join link is not an invitation record.
- [ ] Edit `schema.prisma`. Add `WorkspaceJoinLink` and `AllowedDomain` in one migration.
- [ ] Add `joinLink.get`, `joinLink.reset`, `joinLink.preview`, and `joinLink.join` to the contract and the organizations server feature.
- [ ] Create `apps/client/src/app/join/[token]/page.tsx`.
- [ ] Edit the invite dialog. Add a **Copy join link** section with **Reset link**.

**Build.**

- [ ] Put the add-member step in one service method, `joinWithoutInvitation(userId, organizationId)`. It calls Better Auth's server-only `addMember` with role member, whose `afterAddMember` hook already adds the user to the default channel. Joining when already a member only sets the workspace active. A deactivated member is refused.
- [ ] `joinLink.get` creates the link on first read with a 32-byte random token. `joinLink.reset` replaces the token, so every old URL stops working.
- [ ] `joinLink.join` resolves the token and calls `joinWithoutInvitation`. Chain `arcjet.heavyWrite`.
- [ ] `/join/[token]` shows the workspace name signed out and sends the visitor through sign-in with `callbackURL`. Signed in, it shows **Join**.

### Commit 2. Join from an allowed domain

**Files.**

- [ ] Add `allowedDomains.list`, `allowedDomains.set`, `organizations.joinable`, and `organizations.join` to the contract and server.
- [ ] Create `apps/client/src/app/(dashboard)/settings/access/page.tsx` with the join link and the allowed domains.
- [ ] Edit `apps/client/src/features/onboarding/components/workspace-chooser.tsx`. List joinable workspaces beside invitations.
- [ ] Edit `PRD.md`. Mark M0.2 and M0.9 `Shipped`.

**Build.**

- [ ] `allowedDomains.set` stores lower-cased domains and refuses a fixed list of public mail domains such as `gmail.com` and `outlook.com`.
- [ ] `organizations.joinable` returns workspaces whose allowed domains include the caller's email domain, only when `user.emailVerified` is true, minus workspaces they are in or deactivated from.
- [ ] `organizations.join` checks the same condition again, then calls `joinWithoutInvitation`.

**You see.**

- [ ] A copied link joins a new user as a member. After **Reset link**, the old URL shows "This link is no longer valid."
- [ ] A verified user at `@acme.dev` sees "Acme. Join" on onboarding and joins in one click.

**Verify, unit.**

- [ ] Tests cover join by a valid token, a reset token refused, an existing member joining twice without a duplicate row, and a deactivated member refused.
- [ ] Tests cover a matching verified user listed and joined, an unverified user not listed and refused, `eng.acme.dev` not matching `acme.dev`, and `gmail.com` refused at set time.

**Verify, live.**

- [ ] Agent. A signed-out `/join/<token>` shows the workspace name and a sign-in button. A random token shows the invalid message.
- [ ] Operator. Join from a second account with the link, then reset and retry the old link.
- [ ] Operator. Add a domain you control, sign up a second account on it, and join from onboarding.

## Edit the workspace profile and channel permissions (PR4, M0.7 and M0.8)

**Depends on.** PR1.

### Commit 1. Edit the name and URL slug

**Files.**

- [ ] Add `organizations.update` to the contract, reusing the name and slug rules from `CreateOrganizationInputSchema`.
- [ ] Edit the organizations gateway, service, and controller.
- [ ] Create `apps/client/src/app/(dashboard)/settings/general/page.tsx` and its form. Reuse the slug field behavior from `create-workspace-form.tsx`.

**Build.**

- [ ] `organizations.update` calls Better Auth `updateOrganization`. Map `ORGANIZATION_SLUG_ALREADY_TAKEN` to the existing `SLUG_TAKEN` error.
- [ ] The slug appears in no route today, so changing it breaks no link.
- [ ] Renaming the workspace leaves the default channel's name alone. An admin can already rename that channel.

### Commit 2. Upload the workspace icon

**Files.**

- [ ] Create `apps/server/src/storage/` with a port for presigned uploads and its S3 implementation, per `conduit-structure`.
- [ ] Add `organizations.iconUploadUrl` to the contract.
- [ ] Edit the general settings form. Add an icon picker.

**Build.**

- [ ] `organizations.iconUploadUrl` returns a presigned PUT URL for an image under 1 MB with an image content type. The client uploads, then saves the public URL through `organizations.update` as `logo`.
- [ ] The switcher and the sidebar header show the icon, and fall back to the current initials when there is none.

### Commit 3. Choose who can create channels

**Files.**

- [ ] Edit `schema.prisma`. Add `WorkspaceSettings` and its migration.
- [ ] Edit `packages/contract/src/lib/channel-policy.ts` and its test.
- [ ] Add `workspaceSettings.get` and `workspaceSettings.update` to the contract and server.
- [ ] Edit `apps/server/src/channels/application/channels.service.ts` where `create` authorizes.
- [ ] Create `apps/client/src/app/(dashboard)/settings/permissions/page.tsx`.
- [ ] Edit the create channel dialog under `apps/client/src/features/channels/`.
- [ ] Edit `PRD.md`. Mark M0.7 and M0.8 `Shipped`.

**Build.**

- [ ] Replace `channelPolicy.create`, which allows everyone, with `canCreateChannel(role, visibility, settings)`. A member passes when `channelCreators` is `'everyone'`, and for a public channel also when `publicChannelCreators` is `'everyone'`. Admins always pass.
- [ ] `makePublic` is already admin-only, so a member cannot use it to get around `publicChannelCreators`.
- [ ] The create dialog hides the public option, or the whole entry point, per the same function.

**You see.**

- [ ] A new name and icon show in the switcher and the sidebar header without a reload. A taken slug shows "That URL is already taken." under the field.
- [ ] With public creation set to admins, a member's create dialog offers only private, and a forced public create returns `FORBIDDEN`.

**Verify, unit.**

- [ ] Service tests cover a name update, a taken slug refused with `SLUG_TAKEN`, and a refused public create.
- [ ] `channel-policy.test.ts` covers the four setting combinations for each role.
- [ ] A storage test refuses a non-image content type and a file over 1 MB.

**Verify, live.** Operator, signed in.

- [ ] Rename the workspace, change its slug, and upload an icon, at 360 px and in both themes.
- [ ] Change both channel settings as an admin, then try each create path as a member.

## Close the milestone

- [ ] Every PRD row in M0 reads `Shipped` with its PR link, and the milestone table reads `Shipped`.
- [ ] The exit check passes on `staging`.

## Appendix A. Prototype evidence

None ran. The open forks were product calls, not facts a run could settle. Better Auth's role and slug rules were read from the installed source, version 1.7.1, rather than prototyped.

## Appendix B. Decisions

The operator accepted every default on 2026-11-06.

1. **Who can invite.** Owners and admins, which is Better Auth's default.
2. **Where the workspace icon is stored.** S3 through presigned uploads, in PR4. M3 and user avatars reuse the storage port.
3. **What deactivation means.** The person keeps their account and channel memberships but loses all access to that workspace until reactivated.
4. **Which domains an admin may allow.** Public mail domains are refused. The admin's own email does not have to match.
5. **Join link lifetime.** No expiry, role member, and reset as the only control.

The operator asked for fewer, larger PRs. The first draft's eight PRs became four. Each old PR is now a commit, so the review order is unchanged.

## Appendix C. Alternatives rejected

- **Better Auth `additionalFields` on `member` for deactivation.** Better Auth has no endpoint to write an arbitrary member field, so the app would write a Better Auth table through Prisma, which `conduit-structure` forbids.
- **Settings in `Organization.metadata`.** It is an untyped string, and allowed domains need an indexed lookup across workspaces.
- **An `Invitation` row with no email for the join link.** Better Auth ties acceptance to the recipient's email, so a shared link cannot accept it.
- **Linking invitation emails to `/onboarding`.** It works for signed-in users but gives a new person no context about which workspace invited them.
- **A data URL in `Organization.logo`.** Every workspace list would carry the image.
- **One PR per sub-feature.** The operator found PRs such as the join link alone too small to review on their own.

## Appendix D. Risks

- **Better Auth routes bypass the oRPC rules.** PR1. The browser can call `/auth/organization/*` directly. The owner checks that every rule the policy adds beyond Better Auth's own is enforced in a Better Auth hook too.
- **Open redirect through `callbackURL`.** PR2. `isSafeInternalPath` accepts `/\evil.com`, which browsers usually read as `//evil.com`. This is inferred from the code and not yet reproduced. PR2 fixes it with a test.
- **PR1 is the largest PR.** It holds the policy, the shell, and three member actions. Its commits keep it reviewable one step at a time.
- **PR4 needs S3 credentials and a new package.** The icon commit stops until the operator provides them.
- **Migration numbering collides.** PR3 and PR4 can merge in either order.
- **Invitation email abuse.** PR2. `arcjet.heavyWrite` plus the 20-email cap bound it.
- **Membership limit.** PR2 and PR3. `membershipLimit: 100` in `auth.config.ts` caps every join path. The UI should show Better Auth's error text rather than a generic failure.

## Appendix E. Reading list

- `PRD.md`, M0 section, and `GLOSSARY.md`, workspaces and people.
- `apps/server/src/infrastructure/auth/auth.config.ts` for the organization plugin options and hooks.
- `packages/contract/src/lib/channel-policy.ts` as the model for `workspace-policy.ts`.
- `apps/server/src/organizations/` as the model for every Better Auth gateway call.
- `.agents/skills/conduit-structure/SKILL.md` and `.agents/skills/conduit-database/SKILL.md`.
- Better Auth 1.7.1 `dist/plugins/organization/routes/crud-members.mjs` for owner and role rules.
