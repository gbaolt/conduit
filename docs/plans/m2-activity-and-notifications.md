# M2 activity and notifications plan

M2 tells a member what needs them without reading every channel. Today the rail's **Activity** link points at `#`, a mention only highlights a row, and nothing reaches a member who has closed the tab. This plan ships the nine M2 rows in [`PRD.md`](../../PRD.md#m2-activity-and-notifications) as six PRs against `staging`. The feed lives in a new `feed` module, beside the existing `activity` module that keeps read state, drafts, typing, and presence.

The rule the milestone enforces is that every Activity item is a row written in the same transaction as the change that caused it. The feed, the unread badge, push, the email digest, Smart Activity, and Catch me up all read those rows or the read state that M1 already keeps. Nothing infers activity later by scanning messages.

| PR  | Ships                                                 | PRD rows         | Depends on |
| --- | ----------------------------------------------------- | ---------------- | ---------- |
| PR1 | The Activity feed, its filters, and **Mark all read** | M2.1, M2.2       | None       |
| PR2 | Notification levels, mute, and Do Not Disturb         | M2.3, M2.4, M2.5 | None       |
| PR3 | Browser push notifications                            | M2.6             | PR1, PR2   |
| PR4 | The email digest of unread mentions                   | M2.7             | PR1, PR2   |
| PR5 | Smart Activity                                        | M2.8             | PR1        |
| PR6 | Catch me up                                           | M2.9             | PR1, PR2   |

The exit check passes after PR5 and PR6. PR1 and PR2 can run in parallel. PR3, PR4, and PR5 are independent of each other.

## How to read this

One box is one unit of work. Check a box only when its evidence exists, such as a test run, a screenshot, or a SHA. The body is a how-to. The appendices explain and record.

Each PR runs under the poteto-mode Feature playbook and opens against `staging`. Each PR is a sequence of commits, one per **Commit** heading below. Each commit ends green on `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Each PR that changes a PRD row's status updates `PRD.md` in the same diff. Each PR that adds a migration says so in the first line of its body, per `conduit-database`.

Tests alone are not sufficient verification. A PR is verified only when its unit and live boxes are all checked. Signed-in flows need a real session, so the operator runs the signed-in live boxes. The agent runs every unit box, every script, and the signed-out checks.

## Data shapes

These shapes come first. Each PR below adds the ones it needs.

| Shape                  | Lives in                                                      | Holds                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ActivityKind`         | Prisma enum                                                   | `MENTION \| THREAD_REPLY \| REACTION \| ROOM_ADD`. The four things M2.1 names.                                                                                                                                                                                                                                                                                           |
| `ActivityItem`         | Prisma model, app-owned                                       | `{ id, organizationId, userId, roomId, kind, key, actorId, messageId?, emoji?, readAt?, createdAt, updatedAt }`. `userId` is the recipient. Unique on `(userId, key)`, so a retried write is one row. Indexed on `(userId, organizationId, createdAt, id)` for pages and `(userId, organizationId, readAt)` for the live stream. PR5 adds `urgency` and `urgencyReason`. |
| `ActivityItem.key`     | a string the server builds                                    | `message:<messageId>` for a mention or a thread reply, so one message gives a recipient one item. `reaction:<messageId>:<actorId>:<emoji>` for a reaction. `room-add:<roomId>:<joinedAt ms>` for a channel add, so being added again after a removal is a new item.                                                                                                      |
| `FeedEntry`            | `packages/contract/src/schemas/feed.ts`                       | What `feed.list` returns. `{ id, kind, room { id, name, kind }, actor { id, name, image }, message? { id, parentId, body, deletedAt }, emoji?, readAt, createdAt }`.                                                                                                                                                                                                     |
| `NotifyLevel`          | Prisma enum                                                   | `ALL \| MENTIONS \| NOTHING`.                                                                                                                                                                                                                                                                                                                                            |
| `RoomMember.notify`    | `NotifyLevel?` on `RoomMember`                                | Null means the default for the room's kind, which is `MENTIONS` for a channel and `ALL` for a DM. `effectiveNotify(kind, notify)` in `packages/contract/src/lib/notification-policy.ts` resolves it, so the client and server agree.                                                                                                                                     |
| `RoomMember.mutedAt`   | `DateTime?` on `RoomMember`                                   | Set while the room is muted.                                                                                                                                                                                                                                                                                                                                             |
| `NotificationSettings` | Prisma model, app-owned                                       | `{ organizationId, userId, dndUntil?, dndSchedule Json?, timeZone, emailDigest Boolean @default(true) }`, primary key on the pair. No row means defaults. `dndSchedule` is `{ days: number[], start: 'HH:MM', end: 'HH:MM' }`, parsed by a zod schema, and an `end` before `start` runs past midnight.                                                                   |
| `isDndActive`          | `packages/contract/src/lib/notification-policy.ts`            | `(settings, now) => boolean`. True while `dndUntil` is in the future or `now` falls in the schedule in the member's `timeZone`. Pure, so the settings page and the server run the same rule.                                                                                                                                                                             |
| `notificationFor`      | `apps/server/src/notifications/domain/notification-rule.ts`   | `(recipient, event, channel) => boolean` for `channel` of `push` or `email`. One table of rules that PR3 and PR4 share. See Appendix B decision 3.                                                                                                                                                                                                                       |
| `PushSubscription`     | Prisma model, app-owned                                       | `{ id, userId, endpoint @unique, p256dh, auth, createdAt, lastSuccessAt? }`. One row per browser.                                                                                                                                                                                                                                                                        |
| `DigestState`          | Prisma model, app-owned                                       | `{ organizationId, userId, lastSentAt }`, primary key on the pair. A digest sends only when `lastSentAt` is older than the member's last heartbeat, so each away period gets at most one email.                                                                                                                                                                          |
| `LiveStream`           | existing union in `packages/contract/src/schemas/realtime.ts` | Gains `{ kind: 'feed' }`, the caller's unread items in rooms they are still in.                                                                                                                                                                                                                                                                                          |
| `Summary.roomId`       | existing column                                               | Becomes nullable. A summary with no room is a **catch-up**, which the glossary already names.                                                                                                                                                                                                                                                                            |

**Why write items, not derive them.** A feed derived from `Message` at read time cannot order reactions, because `Message.reactions` keeps no time per reaction. It cannot show channel adds, because `RoomMember` keeps no adder. It would also need one live query per source. One table gives one page query, one live stream, one place to keep read state, and one row for Smart Activity to annotate.

**Why the feed stream carries only unread rows.** The stream is `SELECT a."id", a."kind", a."channelId" AS "roomId", a."readAt", a."createdAt", a."updatedAt" FROM "ActivityItem" a JOIN "ChannelMember" cm ON cm."channelId" = a."channelId" AND cm."userId" = a."userId" WHERE a."userId" = $1 AND a."organizationId" = $2 AND a."readAt" IS NULL`. Its row count is the rail's badge. Marking an item read drops it from the result, and leaving a room drops its items, so the badge needs no second query. A change on the stream invalidates the first page of `feed.list`, which returns the full entries. The sidebar stream already joins `ChannelMember`, so Neon Realtime handles the join.

## Program checklist

- [ ] Load the skills AGENTS.md names for each PR before writing code. That is `conduit-structure`, `mattpocock-skills:codebase-design`, `orpc-contract`, `nestjs-best-practices`, `conduit-database` for PRs with a migration, `conduit-components`, `vercel-react-best-practices` and `vercel-composition-patterns` for UI, `next-cache-components-optimizer` for the `/activity` and settings routes, and `next-dev-loop` before reporting a client change done.
- [ ] Ask the operator before installing each package. PR3 needs `web-push` and `@types/web-push` in `apps/server`. No other PR adds a package.
- [ ] Ask the operator to set the new environment values. PR3 needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the server, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on the client. PR4 needs `CRON_SECRET` on the server, plus `CRON_SECRET` and `API_URL` as GitHub Actions secrets. Generate the VAPID pair with `npx web-push generate-vapid-keys`.
- [ ] Number migrations in merge order, starting at `11_`. A PR that merges later renumbers its folder to stay one past the highest.
- [ ] Ask before running any command that writes to a database, per `conduit-database`. That includes `pnpm db:migrate-deploy` and every script in `apps/server/scripts/`.
- [ ] Add each new term to `GLOSSARY.md` in the PR that introduces it. The terms are **Activity item**, **Notification level**, **Mute**, **Do Not Disturb**, **Email digest**, and **Urgency**. PR1 also notes under **Activity** that code calls the feed `feed`. **Activity**, **Notification**, and **catch-up** are already there.

## Show mentions, replies, reactions, and adds in Activity (PR1, M2.1, M2.2)

**Depends on.** None.

### Commit 1. Write an item with every change that causes one

**Files.**

- [ ] Edit `schema.prisma`. Add `ActivityKind` and `ActivityItem` with foreign keys to `User` for both `userId` and `actorId`, to `Room`, and to `Message`, each `onDelete: Cascade`. Write `11_activity` from a diff, per `conduit-database`.
- [ ] Create `apps/server/src/feed/` with `domain/feed.repository.ts`, `domain/feed-recipients.ts` and its test, `domain/feed-errors.ts`, `infrastructure/prisma-feed.repository.ts`, and `feed.module.ts`, which exports the repository.
- [ ] Edit `MessagesRepository.send`, `edit`, `markDeleted`, and `updateReactions`, and the messages service, so each takes the items to write and writes them in its transaction.
- [ ] Edit `RoomsRepository.addMembers` to return the rows it inserted, with `createManyAndReturn` and `skipDuplicates`. Edit `ChannelsService.addMembers` to write a `ROOM_ADD` item for each.

**Build.**

- [ ] `feedItemsFor(message, context)` in `feed-recipients.ts` is a pure function. It returns the items one sent message causes. `context` holds the room's member ids, the online member ids from `Presence`, the thread root's author, and the thread's earlier repliers. Its rules are a table, in this order.
  - [ ] A member named in `mentionedUserIds` gets `MENTION`. `@channel` gives `MENTION` to every member. `@here` gives `MENTION` to the members online at send time.
  - [ ] In a thread, the root's author and every earlier replier get `THREAD_REPLY`, unless they already got `MENTION`.
  - [ ] The author never gets an item for their own message. A non-member never gets one, so a private channel cannot leak through Activity.
- [ ] `MessagesService.send` reads that context, then passes the items to `messages.send`, which inserts them with `createMany` and `skipDuplicates` inside the send transaction. A retried send inserts nothing, since its message already exists.
- [ ] `edit` writes `MENTION` items for members newly mentioned and deletes those for members no longer mentioned. `markDeleted` deletes every item of the message.
- [ ] `react` writes a `REACTION` item for the message's author, unless the author reacted. `unreact` deletes that item.
- [ ] Joining a channel yourself, opening a DM, and being added to the default channel write no item.

### Commit 2. List, mark read, and stream the feed

**Files.**

- [ ] Create `packages/contract/src/schemas/feed.ts` and `contracts/feed.ts` with `feed.list`, `feed.markRead`, and `feed.markAllRead`. Register them in `contract.ts`.
- [ ] Create `apps/server/src/feed/application/feed.service.ts` and its test, and `presentation/feed.controller.ts`.
- [ ] Edit `schemas/realtime.ts` and `live-streams.ts`. Add the `feed` stream with the SQL in the data shapes section.
- [ ] Edit `ActivityService.markRead` in `apps/server/src/activity/`. Inject `FeedRepository`, and after the read state moves, mark read the caller's `MENTION` items in that room on messages the conversation shows, up to the new `lastReadAt`.

**Build.**

- [ ] `feed.list({ filter: 'all' | 'unread', before?, limit })` returns a page of `FeedEntry`, newest first, ordered by `(createdAt, id)`. It joins `ChannelMember`, so an item in a room the caller left is hidden. Chain `authorized`, `arcjet.read`, and `workspaceMember`.
- [ ] `feed.markRead({ ids })` sets `readAt` on the caller's own items only. `feed.markAllRead()` sets it on every unread item of the caller in the workspace. Both are idempotent and chain `arcjet.write`.
- [ ] A message body in an entry is the stored Markdown, cut to 280 characters. A deleted message shows "This message was deleted."

### Commit 3. The Activity page and the rail badge

**Files.**

- [ ] Create `apps/client/src/services/feed/queries.ts` and `hooks.ts`, with `feedQuery(filter)` and `useFeedStream()`.
- [ ] Create `apps/client/src/features/feed/components/feed-list.tsx`, `feed-entry.tsx`, and `feed-filters.tsx`. Add `feed` to `featureDeps` in `apps/client/eslint.config.mjs`, allowed to import `rooms` and `messages`.
- [ ] Create `apps/client/src/app/(dashboard)/(home)/activity/page.tsx`. Prefetch the first page inside `<Suspense>` and wrap it in `HydrateClient`, as the channel page does.
- [ ] Edit `apps/client/src/components/app-shell.tsx`. Point the **Activity** rail link at `/activity`, mark it active on that route, and show the unread count on it. Start `useFeedStream` from `WorkspaceActivity`.
- [ ] Edit `PRD.md`. Mark M2.1 and M2.2 `Shipped`, and set M2 to `In progress`.

**Build.**

- [ ] `FeedList` lists entries with the actor's avatar, a line such as "Linh mentioned you in #design" or "Bao added you to #launch", the message excerpt rendered by `MessageMarkdown`, and the time. Unread entries carry a dot.
- [ ] Clicking or pressing **Enter** on an entry marks it read and opens the message in its conversation, or in its thread panel for a reply, with the same link the **Saved** page uses.
- [ ] **All** and **Unread** are a toggle group above the list. **Mark all read** sits beside it and is disabled when nothing is unread.
- [ ] The rail badge shows the stream's row count, capped as "99+", and is announced as "Activity, 3 unread".
- [ ] The list moves with arrow keys, as `ConversationMessages` does, and works at 360 px.

**You see.**

- [ ] Browser A mentions member B in a channel. B's rail badge goes to 1 without a reload, and `/activity` shows the mention at the top.
- [ ] A replies in a thread B started, and reacts to B's message. B sees a reply entry and a reaction entry. A removing the reaction removes its entry.
- [ ] A adds B to a channel. B sees "A added you to #launch".
- [ ] B opens the channel and reads to the end. The mention entry loses its dot and the badge drops. **Mark all read** clears the rest.
- [ ] A removes B from a private channel. B's entries from that channel disappear.

**Verify, unit.**

- [ ] `feed-recipients.test.ts` covers each rule row, `@here` with nobody online, a mention of a non-member, a self mention, and a mention inside a thread reply giving one `MENTION` and no `THREAD_REPLY`.
- [ ] Service tests, with `TEST_DATABASE_URL` set, cover a retried send writing one item, edit adding and dropping mentions, delete removing items, react and unreact, `addMembers` with a member already present writing no item, `markRead` refusing another member's ids, the room read state marking mentions read, and paging with equal `createdAt`.
- [ ] Run `pnpm --filter @conduit/contract test`, `pnpm --filter server test`, and `pnpm --filter client test`.

**Verify, live.**

- [ ] Agent. Rerun `apps/server/scripts/measure-delivery.ts` against `staging` and against the PR's preview, with a send that mentions `@channel` in a 50-member channel. Record p50, p95, and p99 for both in the PR body. Fail at a head p95 of 200 ms or more, or 30 ms or more above `staging`.
- [ ] Operator. Run **You see** in two browsers, at 360 px and in both themes, with the keyboard only.

## Set notification levels, mute, and Do Not Disturb (PR2, M2.3, M2.4, M2.5)

**Depends on.** None. It does not need PR1.

### Commit 1. Store the preferences

**Files.**

- [ ] Edit `schema.prisma`. Add `NotifyLevel`, `RoomMember.notify`, `RoomMember.mutedAt`, and `NotificationSettings`. Write `12_notification_settings`.
- [ ] Create `packages/contract/src/lib/notification-policy.ts` and its test, with `effectiveNotify` and `isDndActive`.
- [ ] Add `rooms.setNotify`, `rooms.mute`, `rooms.unmute`, `notificationSettings.get`, and `notificationSettings.update` to the contract. `setNotify` and mute serve both kinds, so they live in the rooms base, per `conduit-structure`.
- [ ] Create `apps/server/src/notifications/` with the settings port, its Prisma repository, the service, and the controller.

**Build.**

- [ ] `rooms.setNotify({ roomId, level })` accepts `null` to go back to the default. Only a member of the room can set it.
- [ ] `notificationSettings.update` takes `dndUntil`, `dndSchedule`, `timeZone`, and `emailDigest`. It rejects a `timeZone` that `Intl.DateTimeFormat` does not accept and a schedule whose times are not `HH:MM`.
- [ ] `isDndActive` reads the local weekday and time in `timeZone` with `Intl.DateTimeFormat(..., { timeZone })`, so no date library is needed.

### Commit 2. Show and change them

**Files.**

- [ ] Edit the room header menu in `features/rooms/`. Add a **Notifications** submenu with **All new messages**, **Mentions only**, and **Nothing**, the default marked, and **Mute** or **Unmute**.
- [ ] Edit `live-streams.ts` and the sidebar. Add `cm."mutedAt"` to the sidebar stream.
- [ ] Create `apps/client/src/features/workspace/components/workspace-settings/notifications/` and the route `apps/client/src/app/(dashboard)/settings/notifications/page.tsx`.
- [ ] Edit the nav user menu. Add **Pause notifications** with 30 minutes, 1 hour, 2 hours, **Until tomorrow**, and **Resume**.
- [ ] Edit `PRD.md`. Mark M2.3, M2.4, and M2.5 `Shipped`.

**Build.**

- [ ] A muted room shows dimmed in the sidebar with a muted icon, and it never turns bold. A mention in it still shows a count on the row and still goes to Activity.
- [ ] The settings page holds the schedule (days, start, end), the time zone read from the browser and editable, and the **Email me about unread mentions** switch that PR4 reads.
- [ ] While Do Not Disturb is on, the nav avatar shows a moon, and the menu says when it ends.
- [ ] Levels, mute, and Do Not Disturb change no Activity item. They decide only what PR3 and PR4 send. See Appendix B decision 3.

**You see.**

- [ ] Muting a channel dims it, and new messages in it do not bold it. Unmuting restores it.
- [ ] **Pause notifications** for 30 minutes shows the moon and "Paused until 3:40 PM". **Resume** clears it.
- [ ] A schedule of 22:00 to 08:00 shows as on at 23:00 in the chosen time zone.

**Verify, unit.**

- [ ] `notification-policy.test.ts` covers the default per kind, a snooze in the past, a schedule past midnight, a day not in the schedule, and the day a DST change happens in `America/New_York`.
- [ ] Service tests cover a non-member refused from `setNotify`, an invalid time zone refused, and settings scoped to their owner.

**Verify, live.**

- [ ] Operator. Run **You see** at 360 px and in both themes, from the keyboard.

## Send browser push notifications (PR3, M2.6)

**Depends on.** PR1 for the items and PR2 for the rule's inputs.

### Commit 1. Subscribe a browser

**Files.**

- [ ] Edit `schema.prisma`. Add `PushSubscription`. Write `13_push_subscriptions`.
- [ ] Add `push.subscribe({ endpoint, keys })` and `push.unsubscribe({ endpoint })` to the contract and the notifications feature.
- [ ] Create `apps/client/public/sw.js`. It handles `push` by showing the notification, and `notificationclick` by focusing an open Conduit tab and navigating it, or opening one.
- [ ] Edit the client's Content Security Policy. Allow `worker-src 'self'`.
- [ ] Edit the notifications settings page. Add **Turn on desktop notifications**, which asks for permission only on that click.

**Build.**

- [ ] Subscribing upserts on `endpoint`, so a second subscribe from one browser keeps one row, and a browser handed to another account moves to that account.
- [ ] The page shows the browser's state, one of on, off, or blocked, with how to unblock it when blocked.

### Commit 2. Send

**Files.**

- [ ] Create `apps/server/src/notifications/domain/notification-rule.ts` and its test, `domain/push-sender.port.ts`, and `infrastructure/web-push.sender.ts`.
- [ ] Create `apps/server/src/notifications/application/notifications.service.ts` with `dispatchMessage(message)`.
- [ ] Edit `messages.controller.ts`. After a send with a `txid`, call `waitUntil(this.notifications.dispatchMessage(sent.message))`, beside the link preview.
- [ ] Edit `PRD.md`. Mark M2.6 `Shipped`.

**Build.**

- [ ] `notificationFor` is one table. A recipient gets a push when all of these hold. The event is a DM message, a mention, a thread reply, or any message in a room at level `ALL`. The level is not `NOTHING`. The room is not muted, except for a mention. Do Not Disturb is off. The recipient is not online, per `presenceStatus`.
- [ ] Reactions and channel adds never push.
- [ ] The payload is `{ title, body, url, tag }`. The title reads "Linh in #design" or "Linh". The body is the first 120 characters of plain text. `tag` is the room id, so a burst in one room replaces one notification.
- [ ] Each push sets a TTL of 1 hour. A `404` or `410` from the push service deletes the subscription.

**You see.**

- [ ] B turns on notifications and closes the tab. A mentions B, and B's desktop shows "A in #design" within a few seconds. Clicking it opens the message.
- [ ] With B in Do Not Disturb, or the channel muted and no mention, nothing arrives.
- [ ] With B's tab in front, nothing arrives, since B sees it in the app.

**Verify, unit.**

- [ ] `notification-rule.test.ts` runs every row of the rule table, including a mention in a muted room and a DM at the default level.
- [ ] Service tests with a fake `PushSender` cover a `410` deleting the subscription and one push per subscription for a member with two browsers.

**Verify, live.**

- [ ] Agent. Deliver one push to a test subscription from a script against the preview, and record the push service's response code in the PR body.
- [ ] Operator. Run **You see** in Chrome and Firefox. Note whether Safari shows it, since Safari needs the site added to the Dock on macOS for some versions.

## Email a digest of unread mentions (PR4, M2.7)

**Depends on.** PR1 and PR2.

### Commit 1. Find who is due and send

**Files.**

- [ ] Edit `schema.prisma`. Add `DigestState`. Write `14_digest_state`.
- [ ] Create `apps/server/src/notifications/domain/digest.ts` and its test, `domain/digest-email.ts`, and `presentation/digests.controller.ts`.
- [ ] Add `sendDigests(now)` to `NotificationsService`.

**Build.**

- [ ] A member is due when all of these hold. Their last heartbeat is more than 1 hour old. `DigestState.lastSentAt` is missing or older than that heartbeat. `emailDigest` is on, and Do Not Disturb is off. They have unread `MENTION` items created after their last heartbeat that `notificationFor` allows for `email`. A member with no `Presence` row is never due.
- [ ] The service claims each member with a conditional upsert of `DigestState` before sending, so two overlapping runs send one email.
- [ ] The email goes through the existing `resend` client and `emailFrom`. It lists up to 20 mentions, each with the author, the room, the excerpt as plain text, and a link built on `APP_URL`, then "and 4 more". The footer links to the notifications settings page.
- [ ] `POST /internal/digests` runs `sendDigests` and requires `Authorization: Bearer <CRON_SECRET>`, compared in constant time. It returns the count sent.

### Commit 2. Run it on a schedule

**Files.**

- [ ] Create `.github/workflows/email-digest.yml`. A `schedule` of `*/15 * * * *` and `workflow_dispatch` call the endpoint with `curl --fail`.
- [ ] Edit `PRD.md`. Mark M2.7 `Shipped`.

**Build.**

- [ ] The endpoint is idempotent, so a late, repeated, or skipped run only shifts when an email goes out. See Appendix B decision 4 for the scheduler choice.

**You see.**

- [ ] B is mentioned twice and closes the tab. About an hour and up to 15 minutes later, B gets one email with both mentions. A third mention while B is still away sends nothing more. B returns, leaves again, gets mentioned, and gets a new email an hour later.
- [ ] B reads the mentions in the app before the hour is up. No email goes out.

**Verify, unit.**

- [ ] `digest.test.ts` covers every condition, a member with no presence, and a mention already read.
- [ ] A service test runs `sendDigests` twice at once with a fake mailer and asserts one send.
- [ ] A controller test refuses a missing or wrong secret.

**Verify, live.**

- [ ] Agent. Trigger the workflow with `workflow_dispatch` against the preview and record the response count in the PR body.
- [ ] Operator. Run **You see** with a real inbox, and check the email in a dark-mode mail client.

## Rank Activity by urgency and fold the noise (PR5, M2.8)

**Depends on.** PR1.

### Commit 1. Fold and rank by rule

**Files.**

- [ ] Create `packages/contract/src/lib/feed-ranking.ts` and its test, with `foldFeed(entries)` and `rankFeed(groups)`.
- [ ] Edit `feed-list.tsx`. Add a sort select with **Smart** and **Newest**.

**Build.**

- [ ] `foldFeed` merges reactions to the same message into one group, such as "Linh, Bao, and 2 others reacted to your message", and channel adds by one person within an hour into one group. It runs with AI on or off.
- [ ] `rankFeed` orders unread before read. Within each, it orders by tier, which is `urgent`, then `normal`, then `low`, then newest first. Mentions and replies with no urgency yet count as `normal`. Reactions and channel adds are always `low`.

### Commit 2. Let the model judge urgency

**Files.**

- [ ] Edit `schema.prisma`. Add `ActivityUrgency` (`URGENT | NORMAL | LOW`), `ActivityItem.urgency`, and `ActivityItem.urgencyReason`. Write `15_activity_urgency`.
- [ ] Create `apps/server/src/feed/domain/urgency-prompt.ts` and its test.
- [ ] Add `feed.rank()` to the contract and `FeedService`.
- [ ] Create `apps/server/scripts/eval-smart-activity.ts`.
- [ ] Edit `PRD.md`. Mark M2.8 `Shipped`.

**Build.**

- [ ] `feed.rank()` checks `AiAccessService.assertEnabled`, takes up to 20 of the caller's unread `MENTION` and `THREAD_REPLY` items with no urgency, and reads their messages through the same read check as `messages.get`. It chains `arcjet.heavyWriteByWorkspace`.
- [ ] `urgency-prompt.ts` lays out each message under a short label, as `summary-prompt.ts` does, with the same rule that message text is data and not instructions. It tells the model who the recipient is. The model returns `{ items: { label, urgency, reason }[] }` through structured output, with `reason` under 60 characters, such as "Asks you a direct question". The service drops unknown labels.
- [ ] The call uses `AI_SUMMARY_MODEL` and sets `maxOutputTokens` to 800.
- [ ] The client calls `feed.rank()` when the feed opens in **Smart** with unranked unread items, then refetches. The feed shows at once in rule order and reorders when ranks land.
- [ ] An urgent entry shows its reason with an AI marker. With AI off, **Smart** still folds and ranks by rule, and no reason shows.

**You see.**

- [ ] The second half of the exit check. A asks B "can you review the invite flow today?" with a mention, and C reacts to two of B's messages. B's feed in **Smart** shows A's question first with "Asks you a direct question", and the reactions folded at the bottom.
- [ ] With AI off, the feed still folds, and `feed.rank` refuses with `AI_DISABLED`.

**Verify, unit.**

- [ ] `feed-ranking.test.ts` covers folding across messages, the tier order, and read items after unread.
- [ ] Service tests with a fake `ModelPort` cover an unknown label dropped, an item in a room the caller left skipped, and a refusal while AI is off.
- [ ] `eval-smart-activity.ts` runs 12 fixed messages through the real model. It fails when a direct question to the recipient is not `urgent`, or a "thanks" reply is `urgent`. Run it once per model change and record the result in the PR body.

**Verify, live.**

- [ ] Operator. Run **You see** at 360 px and in both themes.

## Catch a member up on everything unread (PR6, M2.9)

**Depends on.** PR1 for the items and PR2 for mute.

### Commit 1. Gather unread messages and summarize them

**Files.**

- [ ] Edit `schema.prisma`. Make `Summary.roomId` nullable. Write `16_catch_up`.
- [ ] Add `summaries.catchUp()` to the contract, streaming through an event iterator like `summaries.room`.
- [ ] Add `MessagesService.listForCatchUp(viewer)` and its repository query.
- [ ] Edit `summary-prompt.ts`. Add a `room` attribute to each message tag, and a catch-up system prompt that puts what asks something of the member first.
- [ ] Edit `SummariesService` and its test with `catchUp`.

**Build.**

- [ ] `listForCatchUp` takes, for each room the caller is in and has not muted, the messages the conversation shows after their `lastReadAt`, or after `joinedAt` with no read state. It adds the messages behind the caller's unread `MENTION` and `THREAD_REPLY` items, so thread replies to them count. It reads through the same channel read check as `messages.list`.
- [ ] When the set is over `SUMMARY_PROMPT_CHARS_MAX`, it keeps DMs and messages behind items first, then the newest of the rest.
- [ ] The stored catch-up has no room, so `share` refuses it with `NOT_FOUND`. See Appendix B decision 6.
- [ ] Nothing to read refuses with `NOTHING_TO_SUMMARIZE`, as summaries do.

### Commit 2. Show it at the top of Activity

**Files.**

- [ ] Edit `apps/client/src/services/messages/summaries.ts`. Add a `catch-up` target to `useSummaryRun`.
- [ ] Edit `features/messages/components/summary/summary-card.tsx`. Show the room on each source link and hide **Share to thread** for a catch-up.
- [ ] Edit `feed-list.tsx`. Add a **Catch me up** button above the filters.
- [ ] Edit `PRD.md`. Mark M2.9 `Shipped`, and mark M2 `Shipped` once the exit check passes.

**Build.**

- [ ] **Catch me up** shows "Since 9:12 AM", from the oldest unread message, and streams the card above the feed. Each bullet links to its sources, which open in their own conversations, since the card already builds links from each message's `roomId`.
- [ ] With nothing unread, the button reads "You're all caught up" and is disabled. With AI off, it is gone.
- [ ] Running a catch-up marks nothing read.

**You see.**

- [ ] The first half of the exit check. B is away while A and C post in two channels and a DM, and mention B in a thread. B opens Conduit, clicks **Catch me up**, and gets bullets that cover all three rooms and the thread, each with source links that open the right message.
- [ ] A muted channel's messages do not appear in it.

**Verify, unit.**

- [ ] Tests with a fake `ModelPort` cover a private channel the caller left excluded, a muted room excluded, a thread reply behind an item included, and the priority cut when over the cap.
- [ ] Extend `eval-summaries.ts` with one fixed catch-up across three rooms. It fails when a bullet cites a message that does not support it.

**Verify, live.**

- [ ] Operator. Run the whole exit check in two browsers, at 360 px and in both themes.

## Close the milestone

- [ ] Every PRD row in M2 reads `Shipped` with its PR link, and the milestone table reads `Shipped`.
- [ ] The exit check passes on `staging`. A member who was away opens Conduit, Catch me up shows what they missed with a link to each source, and the Activity feed puts a direct question to them above reactions to their messages.
- [ ] The delivery probe from PR1 still shows p95 under 200 ms on `staging`.
- [ ] Set the PRD's success-metric baselines, now that M2 has shipped, in a PR against `PRD.md`.

## Appendix A. Prototype evidence

No prototype ran for this plan. Everything below was read from source on 2026-11-13, at `a4407b5` on `staging`.

- The `activity/` module on the server and `services/activity/` on the client hold read state, drafts, typing, and presence, so the feed takes its own `feed` module.
- `PrismaMessagesRepository.send` runs one transaction that inserts the message, bumps `lastMessageAt`, bumps the root's `replyCount`, and reads `pg_current_xact_id()`. PR1 adds one `createMany` to it.
- `Message.reactions` is a JSON map of emoji to user ids with no time per reaction. `RoomMember` keeps `joinedAt` but no adder.
- The sidebar live query already joins `ChannelMember`, `Channel`, `ReadState`, and `Draft`, so a joined live query works on Neon Realtime.
- `summary-card.tsx` builds each source link from the message's `roomId`, so a catch-up across rooms links without new client code.
- `apps/server/vercel.json` deploys the API to Vercel. The Vercel docs list Hobby cron jobs at once per day, and the M1 plan places the account on Hobby.
- The server already depends on `resend` and `ai`. `web-push` is not installed.

These stay unproven until their PR runs.

- That the extra `createMany` keeps the send path under the 200 ms p95 target with `@channel` in a 50-member channel. PR1's live box measures it.
- That `web-push` runs on the Vercel Node runtime. It needs Node's `crypto`, so it would not run in the Workers build that `src/worker.ts` keeps. PR3's agent box proves the Vercel path.
- How late GitHub's scheduled workflows start in practice. PR4 records the delay of its first runs.

## Appendix B. Decisions

Defaults the owner applies unless the operator says otherwise.

1. **The feed gets its own `feed` module.** The existing `activity/` module keeps read state, drafts, typing, and presence, and keeps its name. The UI, the route `/activity`, and the `ActivityItem` model still say Activity, since that is the glossary term members see. PR1 adds a line to the glossary entry saying code calls the feed `feed`. `ActivityService.markRead` injects `FeedRepository` for the one place the two meet.
2. **Write items in the cause's transaction.** Items and their message commit together, so the feed never shows a mention of a message that failed to send, or misses one that sent. Push, which calls an outside service, runs after commit through `waitUntil`, as link previews do.
3. **Levels, mute, and Do Not Disturb shape Notifications, not Activity.** The glossary defines a Notification as a push or email about something in Activity, so Activity stays a full record and the preferences decide what leaves the app. A mention in a muted room still pushes, so muting a busy channel never hides a question to you. The operator could instead make **Nothing** also hide items from Activity.
4. **GitHub Actions runs the digest schedule.** Vercel Hobby crons run once a day, which misses a 1-hour wait. GitHub's free scheduled workflows run every 15 minutes at best, often late, and GitHub disables them after 60 days without repository activity. The endpoint is idempotent, so swapping in Upstash QStash or a Cloudflare cron trigger later changes only the caller.
5. **The digest covers mentions only, as the PRD row says.** Unread DMs are the obvious next addition. Adding them is one more item kind in the digest query.
6. **A catch-up cannot be shared.** It has no thread to share into, and it spans rooms that other members may not be in. The AI rules allow keeping it private.
7. **Smart Activity ranks on open, in a batch.** Ranking at send time would call the model once per mention, which the free AI credits in M1's decision 5 cannot sustain. One call per feed open covers up to 20 items.
8. **Folding is a rule, not AI.** Reactions to one message and adds by one person fold the same way with AI off, so the feed stays usable when an admin turns AI off. The model only judges urgency.
9. **`@here` means online at send time.** It reads `Presence` with the same 2-minute window as the presence dots.

## Appendix C. Alternatives rejected

- **Derive the feed from `Message` at read time.** It cannot order reactions or show adds without new columns anyway, and it needs a live query per source. See the data shapes section.
- **Fan out after commit with `waitUntil`.** It keeps the send transaction smaller, but a crash between commit and fan-out loses items for good, and a retried send cannot redo it, since its `txid` is null.
- **One item per reaction folded at write time.** Updating a shared row on each reaction needs a row lock and a JSON merge, and unreacting must split it again. Folding at read time is one pure function.
- **Vercel cron.** Once a day on Hobby. Pro allows once a minute, and the endpoint would move there unchanged if the plan changes.
- **A separate push vendor, such as OneSignal or Firebase.** Web Push with VAPID needs one package and no third-party account, and message excerpts stay encrypted end to end to the browser.
- **A notifications table per channel in addition to Activity.** Two records of the same event can disagree. Push and email read Activity items and the room's level.

## Appendix D. Risks

- **The send path grows.** PR1. Each send now reads members, presence, and thread repliers, then inserts items. The delivery probe gates it.
- **A large unread set makes the feed stream heavy.** PR1. The stream returns every unread row, and a member who never opens Activity collects them. Teams of 5 to 50 keep this small. If a member passes 500 unread, cap the stream with a `createdAt` floor and show "500+".
- **Access lags by up to 60 s on the stream.** PR1. As in M1, a removed member keeps a sealed query until it expires. `feed.list` refuses at once.
- **Push is browser-dependent.** PR3. Safari support varies by version, and a member who blocks permission must unblock it in browser settings. The settings page explains how.
- **The Workers build cannot send push.** PR3. `web-push` needs Node's `crypto`. Production runs on Vercel, so this matters only if the API moves to Workers.
- **Resend's free tier caps daily email.** PR4. It allows 100 emails a day, shared with invitations and codes. One digest per away period keeps a 50-member team under it. When Resend refuses, the run leaves `DigestState` unclaimed so the next run retries.
- **Scheduled workflows run late or stop.** PR4. A late run delays an email, which the PRD's 1-hour placeholder tolerates. The workflow is re-enabled by any push to the repository.
- **A message can try to steer the ranking.** PR5. The prompt treats message text as data, and the worst outcome is one item ranked too high in one member's own feed.
- **Free AI credits run out.** PR5 and PR6. The feed then ranks by rule, and Catch me up shows "AI is unavailable right now", as summaries do.

## Appendix E. Reading list

- `PRD.md`, the M2 section and the AI rules, and `GLOSSARY.md`, the Attention and AI sections.
- [`m1-messaging.md`](m1-messaging.md) for the realtime, read state, and summary designs this plan extends.
- `apps/server/src/realtime/application/live-streams.ts` for the stream SQL.
- `apps/server/src/messages/infrastructure/prisma-messages.repository.ts` for the send transaction.
- `apps/server/src/summaries/` for the prompt, citation, and streaming patterns PR5 and PR6 reuse.
- `apps/client/src/features/messages/components/saved-messages.tsx` for the list-and-open pattern the Activity page follows.
- The [Web Push protocol](https://datatracker.ietf.org/doc/html/rfc8030) and the `web-push` package's README before PR3.
- Vercel's [cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) page for decision 4.
