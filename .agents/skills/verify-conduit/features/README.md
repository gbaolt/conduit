# Conduit verification map

This directory is the maintained source for verifying Conduit's user-facing behavior. Read this index before you drive the app. Then use the matching feature file as the recipe.

## Baseline preconditions

- `drive.py doctor` passes: both ports answer, `/auth/ok` is ok, `/sign-in` renders, and dev database migrations are up to date.
- The client is at `http://localhost:3000` and the API at `http://localhost:3333`. These are fixed, so only one instance can run.
- A fresh account comes from the `account` journey. Later journeys run in its workspace, where the account is the owner and the only member, AI is off, and there is no history.
- Features that need other members, history, or AI on use the seeded workspace through the `seed` journey (see SKILL.md, "Seeded workspace").
- Every email is `delivered+<tag>@resend.dev`. The server sends real mail through Resend, and that domain accepts it without a real inbox.

## Driving conventions

- Prefer `get_by_role` with the accessible name. The names below come from the live accessibility tree.
- Wait on a visible role or name with `expect(...)`, never on a fixed sleep. The first visit to a route in `next dev` compiles for 60 to 90 seconds.
- Navigate with `run.visit(url)`, which waits for hydration. A fill made before hydration is silently wiped.
- A sidebar channel link is named `<channel> , unread` while it has unread messages. Match it with `channel_link(name)` in `drive.py`, not an exact name.
- Prove each mutation through a second view: a reload, or the page that lists the thing.
- A journey creates its own rows. Never edit or delete data that a run did not create.

## Proof and skip reporting

- Each journey takes a screenshot of the action and of the resulting state. The final reply embeds them (see SKILL.md, "Report with screenshots").
- Report an unreachable path with the step that failed and the precondition that was not met. Never report it as verified through a different path.

## Features

- [Account and onboarding](./account-onboarding.md) covers sign-up, email verification, sign-in, and creating a workspace. Journey: `account`.
- [Messages](./messages.md) covers sending in a channel, formatting, persistence, and the message actions. Journey: `message`.
- [Channels](./channels.md) covers creating and browsing channels from the sidebar. Journey: `channel`.
- [Workspace members and invitations](./workspace-invitations.md) covers the members table and inviting people. Journey: `invite`.
- [AI summaries](./ai-summaries.md) covers channel summaries, sources, and Catch me up in the seeded workspace. Journeys: `seed`, `summary`, `catchup`.

Not mapped yet: DMs (`/dms/[roomId]`), threads, the rest of Activity (`/activity`), Saved (`/saved`), notification settings, and the admin settings pages `access`, `ai`, `general`, and `permissions`.
