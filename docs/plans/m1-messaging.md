# M1 messaging plan

M1 turns Conduit from a list of channels into a chat app. Today a channel page shows its header and nothing else, and nothing in the stack delivers realtime updates or calls a model. This plan ships the nineteen M1 rows in [`PRD.md`](../../PRD.md#m1-messaging) as five PRs against `staging`. A delivery probe runs before PR1 to confirm the realtime choice, and it ships no PR. The screen design lives in [`m1-messaging-ui.md`](m1-messaging-ui.md).

The rule the milestone enforces is that Postgres is the only source of truth for everything a member sees change. A write goes through the oRPC API into Postgres. Every open client learns about it from a Neon Realtime live query, never from a second message bus.

| PR  | Ships                                                    | PRD rows                         | Depends on |
| --- | -------------------------------------------------------- | -------------------------------- | ---------- |
| PR1 | Messages in channels, delivered live, with the composer  | M1.1, M1.2, M1.3                 | The probe  |
| PR2 | Mentions, reactions, pins, saved messages, link previews | M1.4, M1.5, M1.11, M1.12, M1.13  | PR1        |
| PR3 | Threads and DMs                                          | M1.6, M1.14, M1.15, M1.16, M1.17 | PR2        |
| PR4 | Unread state, drafts, typing, and presence               | M1.7, M1.8, M1.9, M1.10          | PR1        |
| PR5 | AI summaries and AI admin controls                       | M1.18, M1.19                     | PR3        |

The exit check passes after PR5. PR4 is independent of PR2 and PR3.

## How to read this

One box is one unit of work. Check a box only when its evidence exists, such as a test run, a screenshot, or a SHA. The body is a how-to. The appendices explain and record.

Each PR runs under the poteto-mode Feature playbook and opens against `staging`. Each PR is a sequence of commits, one per **Commit** heading below. Each commit ends green on `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Each PR that changes a PRD row's status updates `PRD.md` in the same diff. Each PR that adds a migration says so in the first line of its body, per `conduit-database`.

Tests alone are not sufficient verification. A PR is verified only when its unit and live boxes are all checked. Signed-in flows need a real session, so the operator runs the signed-in live boxes. The agent runs the signed-out ones, the delivery probe, and every unit box.

## Data shapes

These shapes come first. Each PR below adds the ones it needs.

| Shape                   | Lives in                                    | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Channel.kind`          | Prisma enum on `Channel`                    | `CHANNEL \| DM`. A DM is a `Channel` row with `kind: DM`, no name, and a `dmKey`. Membership stays in `ChannelMember`, so **Turn into a private channel** flips `kind` and sets a name.                                                                                                                                                                                                                                                                              |
| `Channel.dmKey`         | `String? @unique` on `Channel`              | `<organizationId>:<sorted userIds joined by ,>`. Finding or creating a DM is one upsert on it.                                                                                                                                                                                                                                                                                                                                                                       |
| `Channel.lastMessageAt` | `DateTime?` on `Channel`                    | Bumped in the send transaction. The sidebar's unread dot compares it with `ReadState.lastReadAt`.                                                                                                                                                                                                                                                                                                                                                                    |
| `Message`               | Prisma model, app-owned                     | `{ id, channelId, authorId, clientId, parentId?, alsoSentToChannel, body (Markdown text), mentionedUserIds String[], mentionsChannel, mentionsHere, reactions Json, replyCount, lastReplyAt?, linkPreview Json?, pinnedAt?, pinnedById?, editedAt?, deletedAt?, createdAt, updatedAt }`. Unique on `(authorId, clientId)` so a retried send is one row. Indexed on `(channelId, parentId, createdAt, id)` for pages and `(channelId, updatedAt)` for the live query. |
| `MessageBody`           | `packages/contract/src/lib/message-body.ts` | The Markdown subset Conduit stores, and `parseMentions(body)`, which reads `<@userId>`, `<@channel>`, and `<@here>`. The server and the renderer both call it.                                                                                                                                                                                                                                                                                                       |
| `ReactionSummary`       | `packages/contract/src/schemas/messages.ts` | `Record<emoji, userId[]>`, stored in `Message.reactions` and written in the same transaction as the reaction. Keeping it on the row means one live query carries reactions too.                                                                                                                                                                                                                                                                                      |
| `ReadState`             | Prisma model, app-owned                     | `{ channelId, userId, lastReadAt, lastReadMessageId }`, primary key on the pair.                                                                                                                                                                                                                                                                                                                                                                                     |
| `Draft`                 | Prisma model, app-owned                     | `{ channelId, userId, parentId?, body, updatedAt }`, unique on `(channelId, userId, parentId)`.                                                                                                                                                                                                                                                                                                                                                                      |
| `SavedMessage`          | Prisma model, app-owned                     | `{ userId, messageId, savedAt }`, primary key on the pair.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `TypingState`           | Prisma model, app-owned                     | `{ channelId, userId, parentId?, until }`. Upserted at most once every 3 s while a member types. The client hides rows whose `until` has passed.                                                                                                                                                                                                                                                                                                                     |
| `Presence`              | Prisma model, app-owned                     | `{ organizationId, userId, lastActiveAt, away }`. A heartbeat every 60 s while a tab is visible. The client reads online as `lastActiveAt` under 2 minutes old and `away` false.                                                                                                                                                                                                                                                                                     |
| `LiveStream`            | `packages/contract/src/schemas/realtime.ts` | The streams a client may ask to seal. `{ kind: 'conversation', channelId } \| { kind: 'thread', channelId, parentId } \| { kind: 'typing', channelId } \| { kind: 'sidebar' } \| { kind: 'presence' }`. The server owns the SQL for each. The client never sends SQL.                                                                                                                                                                                                |
| `WorkspaceSettings`     | existing model                              | Gains `aiEnabled Boolean @default(true)`. No row still means defaults.                                                                                                                                                                                                                                                                                                                                                                                               |
| `Summary`               | Prisma model, app-owned                     | `{ id, organizationId, requesterId, channelId, parentId?, from?, to?, bullets Json, sourceMessageIds String[], sharedMessageId?, createdAt }`. Only the requester can read it until `sharedMessageId` is set.                                                                                                                                                                                                                                                        |

**Why Markdown text and not Lexical JSON.** Summaries, search in M3, the email digest in M2, link previews, and the agent API in M7 all read message text. Markdown is text they can read without Lexical. The cost is that the composer offers only what Markdown can hold, so it drops the kit's font, color, table, and layout tools.

**Why the live query reads `Message.updatedAt`.** The conversation stream is `SELECT ... FROM "Message" WHERE "channelId" = $1 AND ("parentId" IS NULL OR "alsoSentToChannel") AND "updatedAt" >= $2`, with `$2` set to the time the page loaded. New messages, edits, deletes, reactions, reply counts, pins, and previews all bump `updatedAt`, so one stream per open conversation carries every change. History before `$2` loads through `messages.list` pages.

## Program checklist

- [ ] Load the skills AGENTS.md names for each PR before writing code. That is `conduit-structure`, `mattpocock-skills:codebase-design`, `orpc-contract`, `nestjs-best-practices`, `conduit-database` for PRs with a migration, `vercel-react-best-practices` and `vercel-composition-patterns` for UI, `next-cache-components-optimizer` for the new routes, and `next-dev-loop` before reporting a client change done.
- [ ] Ask the operator before installing each package. PR1 needs `@neon/realtime`, `react-markdown`, `remark-gfm`, `remark-breaks`, `rehype-sanitize`, `rehype-external-links`, and `unist-util-visit`. PR5 needs `ai`, which includes the gateway provider, and `@openrouter/ai-sdk-provider` for local development.
- [ ] Ask the operator to run `neon realtime enable` on the dev and production branches, and to add `NEON_REALTIME_URL` and `NEON_REALTIME_SECRET` to Vercel and to `apps/server/.env` with `neon env pull --service realtime`.
- [ ] Number migrations in merge order. Every PR adds one. A PR that merges later renumbers its folder to stay one past the highest.
- [ ] Add `NEON_REALTIME_URL` to the client's `connect-src`, since the browser connects to Neon's ingress directly.
- [ ] Add each new term to `GLOSSARY.md` in the PR that introduces it. The terms are **Message**, **Reply**, **Mention**, **Reaction**, **Pin**, **Saved message**, **Draft**, **Unread marker**, **Online**, and **Away**.

## Measure Neon Realtime delivery before PR1

This is research, not a PR. It runs on a local throwaway branch that is never pushed. Its output is a number and a decision, recorded in Appendix A before PR1 starts. PR1 commits the probe script so the exit check can rerun it.

**Build.**

- [ ] A scratch `SpikeMessage { id, channelId, body, createdAt, updatedAt }` table on a Neon dev branch with Realtime enabled.
- [ ] A script, `apps/server/scripts/measure-delivery.ts`, that seals the conversation-shaped query, opens two subscribers in two Node processes, inserts 500 rows through Prisma at one per 200 ms, and logs each row's insert-commit to subscriber-receive time. It prints p50, p95, and p99.
- [ ] Run it from a machine near the users and again from a Vercel function in the API's region, so the number includes the API hop that PR1 adds.
- [ ] Check that a sealed query renewed before `expiresAt` keeps one subscription without a gap, and that a query for a removed member's channel stops at expiry when the server refuses to renew.

**Decision rule.**

- [ ] p95 under 150 ms end to end leaves headroom under the 200 ms target. Proceed with this plan.
- [ ] p95 of 150 ms or more, or any lost row, switches PR1's transport to the fallback in Appendix C. The rest of the plan keeps its shape, because only `LiveQueries` and `useLiveStream` change.

## Send messages in channels, delivered live (PR1, M1.1, M1.2, M1.3)

**Depends on.** The probe's decision.

### Commit 1. Store, list, send, edit, and delete messages

**Files.**

- [ ] Edit `apps/server/database/schema.prisma`. Add `Message`, `Channel.kind`, `Channel.dmKey`, `Channel.lastMessageAt`. Write the migration from a diff, per `conduit-database`.
- [ ] Create `packages/contract/src/schemas/messages.ts`, `contracts/messages.ts`, `lib/message-body.ts` and `message-body.test.ts`. Register them in `contract.ts`.
- [ ] Create `apps/server/src/messages/` with `domain/messages.repository.ts`, `domain/message-errors.ts`, `application/messages.service.ts`, `infrastructure/prisma-messages.repository.ts`, `presentation/messages.controller.ts`, and `messages.module.ts`.
- [ ] Edit the channels repository and every channel list and browse query. Filter on `kind: CHANNEL`, so DMs never show as channels once PR3 adds them.

**Build.**

- [ ] `messages.list({ channelId, before?, limit })` returns a page of top-level messages, newest first, ordered by `(createdAt, id)`. Chain `authorized`, `arcjet.read`, `workspaceMember`, and check channel read access through `channelPolicy`.
- [ ] `messages.send({ channelId, clientId, body })` checks that the caller can post. It parses the body with `message-body.ts`, inserts the row, bumps `Channel.lastMessageAt`, and returns the message plus the Postgres transaction id from `SELECT pg_current_xact_id()::text` inside the same Prisma transaction. A repeated `(authorId, clientId)` returns the existing row. Chain `arcjet.write`. An archived channel refuses with `ARCHIVED`.
- [ ] `messages.edit({ messageId, body })` lets only the author edit and sets `editedAt`.
- [ ] `messages.delete({ messageId })` lets the author, a channel manager, or a workspace admin delete. It sets `deletedAt` and clears `body`, so the row keeps its place for thread replies in PR3.
- [ ] `message-body.ts` caps a body at 4,000 characters and rejects an empty one after trimming.

### Commit 2. Deliver changes through a live query

**Files.**

- [ ] Create `packages/contract/src/schemas/realtime.ts` and `contracts/realtime.ts` with `realtime.seal`.
- [ ] Create `apps/server/src/realtime/domain/live-queries.port.ts` and `infrastructure/neon-live-queries.ts`.
- [ ] Create `apps/client/src/services/messages/queries.ts`, `hooks.ts`, and `live.ts`.

**Build.**

- [ ] `realtime.seal({ stream })` checks access for that `LiveStream`, builds its SQL on the server, and returns `realtime.seal()`'s capability, `expiresAt`, and fingerprint. `NEON_REALTIME_SECRET` never leaves the server.
- [ ] `useLiveStream(stream)` in `services/messages/live.ts` is the one place realtime enters the client. It seals, subscribes, renews 10 s before `expiresAt`, and resubscribes after a reconnect. It writes each change into the React Query cache for `messagesQuery(channelId)`, deduplicated by `id` and ordered by `(createdAt, id)`.
- [ ] `useSendMessage` inserts an optimistic row keyed by `clientId`, calls `messages.send`, then waits for the returned transaction id on the stream with `awaitTxId` before it marks the row confirmed. A failure marks the row **Not sent** with **Retry** and **Delete**.
- [ ] A removed or deactivated member's renewal is refused, so their live feed stops within 60 s of losing access.

### Commit 3. Show the conversation and its composer

**Files.**

- [ ] Create `apps/client/src/features/messages/components/conversation.tsx`, `message-list.tsx`, `message-row.tsx`, `message-actions.tsx`, `composer.tsx`, `composer-toolbar.tsx`.
- [ ] Create `apps/client/src/features/messages/lib/markdown/` with `message-markdown.tsx`, `remark-mentions.ts`, `rehype-code.ts`, `sanitize-schema.ts`, and tests.
- [ ] Create `apps/client/src/components/code-block.tsx`, ported from `D:/dev/giabao.dev/apps/web/components/ui/code-block`. It sits in `components/` because the renderer, summaries, canvas in M4, and search results in M3 all show code. It builds on `Button` and `Tooltip` from `@conduit/ui`.
- [ ] Edit `apps/client/src/app/(dashboard)/(home)/channels/[channelId]/page.tsx`. Prefetch the first page and render `Conversation` under the header.
- [ ] Edit `PRD.md`. Mark M1.1, M1.2, and M1.3 `Shipped`, and set M1 to `In progress`.

**Build.**

- [ ] `Conversation` composes `MessageScrollerProvider`, `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, one `MessageScrollerItem` per message, and `MessageScrollerButton`. It loads older pages when the start comes into view and keeps the reading position with `scrollAnchor`. It does not use `@conduit/ui/components/message`.
- [ ] `MessageRow` groups consecutive messages by one author within 5 minutes and shows day dividers, per the UI guideline.
- [ ] `composer.tsx` is a `LexicalComposer` built from the editor kit with only these nodes and plugins. It uses rich text, history, lists, links, auto link, Markdown shortcuts, inline code and code blocks with `CodeHighlightPlugin`, the floating text format toolbar, `MaxLengthExtension` at 4,000, and `TabFocusPlugin`. **Enter** sends. **Shift+Enter** adds a line, and **Enter** inside a code block adds a line. It exports with `$convertToMarkdownString` and the kit's transformers, and edit mode loads with `$convertFromMarkdownString`.
- [ ] `MessageMarkdown` adapts giabao.dev's `components/app/markdown.tsx` and `lib/rehype-code-block.ts` for chat. It renders on the client with the synchronous `Markdown` from `react-markdown`, because live messages arrive in the browser. Its plugins are `remark-gfm`, `remark-breaks`, `remark-mentions`, `rehype-sanitize`, and `rehype-external-links`. It drops `rehype-raw`, so a message can never carry HTML. Headings render as bold paragraphs. Fenced code renders through `CodeBlock` with copy and wrap, highlighted by the Shiki instance the editor already loads, with plain text until the language loads.
- [ ] `MessageMarkdown` is wrapped in `memo` keyed on the message's `id` and `updatedAt`, so a new message re-renders one row.

**You see.**

- [ ] Two browsers on one channel. A message sent in one appears in the other without a reload. An edit shows `(edited)` on both. A delete removes it on both.
- [ ] Typing `**bold**`, `` `code` ``, `- item`, and a fenced block converts as you type, and the sent message renders the same way it looked in the composer.
- [ ] Pasting `<img src=x onerror=alert(1)>` sends it as visible text.
- [ ] Scrolling up loads older messages without the view jumping.

**Verify, unit.**

- [ ] `message-body.test.ts` covers the length cap, empty bodies, and each mention form.
- [ ] Service tests, with `TEST_DATABASE_URL` set, cover send, a retried `clientId` returning one row, edit by a non-author refused, delete by a channel manager allowed, send to an archived channel refused, and list paging with equal `createdAt`.
- [ ] Renderer tests cover a script tag, a `javascript:` link, and an `onerror` attribute, each rendered inert.
- [ ] Run `pnpm --filter @conduit/contract test`, `pnpm --filter server test`, and `pnpm --filter client test`.

**Verify, live.**

- [ ] Agent. Commit the probe as `apps/server/scripts/measure-delivery.ts` and rerun it against the PR's preview deployment through `messages.send`. Record p50, p95, and p99 in the PR body. Fail at p95 of 200 ms or more.
- [ ] Operator. Run **You see** in two browsers at 360 px wide and in both themes, sending only with the keyboard.

## Mention, react, pin, save, and preview links (PR2, M1.4, M1.5, M1.11, M1.12, M1.13)

**Depends on.** PR1.

### Commit 1. Mentions

**Files.**

- [ ] Edit `apps/client/src/components/editor/nodes/mention-node.ts`. Add `userId` to the node and its JSON.
- [ ] Edit `apps/client/src/components/editor/plugins/mentions-plugin.tsx`. Replace `dummyLookupService` with a lookup that takes its source as a prop.
- [ ] Create `apps/client/src/features/messages/lib/mention-transformer.ts`.

**Build.**

- [ ] The composer feeds the mentions plugin from `members.list`, plus `@channel` and `@here` for members who can post. The transformer writes `<@userId>`, `<@channel>`, and `<@here>`.
- [ ] `messages.send` stores `mentionedUserIds` only for members of the channel. A mention of anyone else renders as plain text.
- [ ] A message that mentions you, `@channel`, or `@here` gets the mention highlight from the UI guideline. Notifications for mentions ship in M2.

### Commit 2. Reactions, pins, and saved messages

**Files.**

- [ ] Edit `schema.prisma`. Add `SavedMessage`.
- [ ] Add `messages.react`, `messages.unreact`, `messages.pin`, `messages.unpin`, `saved.add`, `saved.remove`, `saved.list`, and `messages.listPinned` to the contract and the messages feature.
- [ ] Create `features/messages/components/reaction-bar.tsx`, `pinned-list.tsx`, and `apps/client/src/app/(dashboard)/(home)/saved/page.tsx`.

**Build.**

- [ ] `messages.react` and `unreact` update `Message.reactions` with a row lock, so two members reacting at once both land. Cap a message at 50 distinct emoji.
- [ ] Any member who can post can pin. The channel header gains a **Pinned** count that opens the list.
- [ ] **Save for later** is private to the member. The **Saved** page lists saved messages newest first, with a link that opens each in its conversation.

### Commit 3. Link previews

**Files.**

- [ ] Create `apps/server/src/messages/infrastructure/link-preview.fetcher.ts` and its test.
- [ ] Edit `PRD.md`. Mark M1.4, M1.5, M1.11, M1.12, and M1.13 `Shipped`.

**Build.**

- [ ] After `messages.send` commits, the server fetches the first link's Open Graph title, description, and image with `waitUntil`, then writes `linkPreview`. The live query delivers it.
- [ ] The fetcher resolves the host first and refuses private, loopback, link-local, and metadata addresses, follows at most 3 redirects with the same check, reads at most 512 KB, and gives up after 3 s.
- [ ] The author can remove a preview from their message.

**You see.**

- [ ] Typing `@` lists the channel's members. The sent mention shows as a name, and the mentioned member sees their row highlighted.
- [ ] Two browsers react with the same emoji at once and both see a count of 2.
- [ ] A pasted public URL gains a preview card within a few seconds. A URL to `http://169.254.169.254/` never does.

**Verify, unit.**

- [ ] Tests cover a mention of a non-member stored as text, concurrent reactions, the emoji cap, pin and unpin, saved messages scoped to their owner, and the fetcher refusing each private range, a redirect into one, an oversized body, and a timeout.

**Verify, live.**

- [ ] Operator. Run **You see** in two browsers, at 360 px and in both themes.

## Reply in threads and send DMs (PR3, M1.6, M1.14, M1.15, M1.16, M1.17)

**Depends on.** PR2, because threads edit `message-row.tsx` and the send path after it. DMs need only PR1, but they ship here so the conversation surfaces land together.

### Commit 1. Thread replies and the thread panel

**Files.**

- [ ] Edit the messages contract and service. `messages.send` accepts `parentId` and `alsoSentToChannel`. Add `messages.listReplies`.
- [ ] Create `features/messages/components/thread-panel.tsx`.
- [ ] Edit `apps/client/src/app/(dashboard)/(home)/channels/[channelId]/page.tsx`. Read `?thread=<messageId>` with `nuqs` and open the panel.

**Build.**

- [ ] A reply sets `parentId` to a top-level message. Replies to replies are refused. Sending a reply bumps the root's `replyCount` and `lastReplyAt` in the same transaction, so the channel's stream updates the root's reply line.
- [ ] **Also send to channel** sets `alsoSentToChannel`, and the channel shows that reply with a "replied to a thread" line that opens the thread.
- [ ] The thread panel subscribes to the `thread` stream and reuses `Conversation`, `MessageRow`, and the composer with a checkbox for **Also send to channel**.
- [ ] Deleting a root with replies leaves "This message was deleted." in its place.

### Commit 2. Open and list DMs

**Files.**

- [ ] Add `dms.open`, `dms.list`, `dms.addPeople`, and `dms.convertToChannel` to the contract and a `dms` area of the channels feature on the server.
- [ ] Edit `packages/contract/src/lib/channel-policy.ts` and its test.
- [ ] Create `apps/client/src/features/channels/components/dm-list.tsx` and `new-dm-dialog.tsx`, and `apps/client/src/app/(dashboard)/(home)/dms/[channelId]/page.tsx`.
- [ ] Edit `PRD.md`. Mark M1.6 and M1.14 to M1.17 `Shipped`.

**Build.**

- [ ] `dms.open({ userIds })` adds the caller, sorts the ids, builds `dmKey`, and upserts the DM and its members. Opening the same set twice returns the same DM. One to ten people, the caller included. The caller alone is the self DM.
- [ ] `channelPolicy` treats a DM as private, with no managers, no rename, no archive, and no leave for the self DM.
- [ ] `dms.addPeople` refuses an 11th person with `DM_FULL`. The client then offers **Turn into a private channel**, which calls `dms.convertToChannel` with a name. That sets `kind: CHANNEL`, `visibility: PRIVATE`, the name, and clears `dmKey`, keeping every message and member.
- [ ] The sidebar lists DMs under **Direct messages**, with your self DM first, named "<your name> (you)".

**You see.**

- [ ] A reply in one browser shows in the other's open thread, and the root's "3 replies" line updates in the channel.
- [ ] A reply sent with **Also send to channel** appears in both places.
- [ ] Two browsers exchange DMs. A group DM of three shows all three names. Adding an 11th person offers the conversion, and the converted channel keeps its history.
- [ ] A thread in a DM works the same as in a channel.

**Verify, unit.**

- [ ] Tests cover a reply count under concurrent replies, a reply to a reply refused, and **Also send to channel** listed in the channel page.
- [ ] Tests cover `dms.open` idempotence, the ten-person cap, a non-member refused from a DM, and conversion keeping messages.

**Verify, live.**

- [ ] Operator. Open a thread from a link, reply from the keyboard, and close it with **Escape**.
- [ ] Operator. Run **You see** in two browsers, at 360 px and in both themes.

## Track unread state, drafts, typing, and presence (PR4, M1.7, M1.8, M1.9, M1.10)

**Depends on.** PR1.

### Commit 1. Unread markers and read state

**Files.**

- [ ] Edit `schema.prisma`. Add `ReadState`, `Draft`, `TypingState`, and `Presence` in one migration.
- [ ] Add `readState.mark`, `drafts.get`, `drafts.save`, `typing.ping`, and `presence.heartbeat` to the contract and server.
- [ ] Edit the sidebar channel list and `dm-list.tsx`.

**Build.**

- [ ] Opening a conversation shows the **New** marker above the first message after `lastReadAt`. Reading to the end calls `readState.mark` once, debounced, with the newest visible message.
- [ ] The `sidebar` stream returns, for the caller, each conversation's `lastMessageAt` and their `lastReadAt`. A conversation is bold when the first is later. The same stream adds a conversation to the sidebar the moment someone adds the caller to it.

### Commit 2. Drafts, typing, and presence

**Files.**

- [ ] Create `features/messages/components/typing-line.tsx` and `apps/client/src/components/presence-dot.tsx`. Reuse `@conduit/ui/components/status` if it fits the guideline.
- [ ] Edit `PRD.md`. Mark M1.7 to M1.10 `Shipped`.

**Build.**

- [ ] The composer saves its Markdown to `drafts.save` 1 s after the last keystroke and loads it on open. Sending deletes the draft. The sidebar shows a pencil on conversations with a draft.
- [ ] `typing.ping` upserts `TypingState` with `until` 5 s ahead, sent at most once every 3 s while the composer changes. The open conversation also subscribes to its `typing` stream, and the typing line hides rows past `until` on a 1 s timer.
- [ ] `presence.heartbeat` runs every 60 s while the tab is visible and sends `away: true` when it hides. The `presence` stream returns the workspace's rows. A member shows online when their heartbeat is under 2 minutes old and not away.

**You see.**

- [ ] A message sent while the other browser is on another channel makes that channel bold there. Opening it shows **New** above the message.
- [ ] Typing in one browser shows "Linh is typing" in the other within a second, and it clears 5 s after typing stops.
- [ ] Closing one browser's tab turns that member's dot to away in the other within 2 minutes.
- [ ] A half-written message survives a reload and a switch to another device.

**Verify, unit.**

- [ ] Tests cover read state never moving backward, a draft per thread separate from the channel's, and typing pings throttled to one per 3 s.

**Verify, live.**

- [ ] Agent. Measure database writes per minute with ten simulated members typing and online, and record it in the PR body. Fail above 600 per minute.
- [ ] Operator. Run **You see** in two browsers, at 360 px and in both themes.

## Summarize threads and channels (PR5, M1.18, M1.19)

**Depends on.** PR3, since thread summaries need threads. Appendix B decision 5 must be settled first.

### Commit 1. Turn AI on or off

**Files.**

- [ ] Edit `schema.prisma`. Add `Summary`, and `aiEnabled` on `WorkspaceSettings`.
- [ ] Create `apps/server/src/ai/` with `domain/model.port.ts`, `infrastructure/ai-sdk-model.ts`, and `application/ai-access.service.ts`.
- [ ] Add `aiSettings.get` and `aiSettings.update` to the contract.
- [ ] Create `apps/client/src/app/(dashboard)/settings/ai/page.tsx`.

**Build.**

- [ ] Admins turn AI on or off for the workspace.
- [ ] `ai-access.service.ts` refuses a call with `AI_DISABLED` before it reaches the model.
- [ ] `ai-sdk-model.ts` picks the provider from the environment. `AI_GATEWAY_API_KEY` or Vercel's OIDC token selects the gateway in production. `OPENROUTER_API_KEY` selects OpenRouter in development, with `provider.data_collection: 'deny'` on every request. The model id comes from `AI_SUMMARY_MODEL`.
- [ ] Each call sets `maxOutputTokens`, so one summary cannot drain the free credits.
- [ ] The summary procedures chain `arcjet.heavyWrite` keyed by workspace, so one workspace cannot use up a provider's shared daily request limit.

### Commit 2. Summaries with sources

**Files.**

- [ ] Add `summaries.thread`, `summaries.channel`, and `summaries.share` to the contract. Both summary procedures stream through an oRPC event iterator.
- [ ] Create `features/messages/components/summary-card.tsx`.
- [ ] Edit `PRD.md`. Mark M1.18 and M1.19 `Shipped`, and mark M1 `Shipped` once the exit check passes.
- [ ] Add `AI_SUMMARY_MODEL` and `OPENROUTER_API_KEY` to `apps/server/.env.example`, and ask the operator to set `AI_SUMMARY_MODEL` in Vercel.

**Build.**

- [ ] The service reads messages through the same channel read check as `messages.list`, so the AI sees only what the requester can read.
- [ ] The model returns a typed object, `{ bullets: { text, sourceIds: string[] }[] }`, through the AI SDK's structured output. The service drops any source id that was not in the input, and a bullet left with no source.
- [ ] The summary card shows "Only you can see this", each bullet with its source links, **Share to thread**, and **Dismiss**. A source link scrolls to the message and highlights it.
- [ ] **Share to thread** posts the summary as a message from the requester, with the source links in its body.
- [ ] Workspace data goes only to models whose provider does not train on it, per Appendix B decision 5. Before production, the operator confirms the gateway model's provider terms, since zero data retention per request is a paid-plan feature.

**You see.**

- [ ] The exit check. Two members exchange channel messages, thread replies, reactions, and DMs, and a summary of a 50-message thread links to the messages it used.
- [ ] With AI off, the **Summarize** entries are gone and the API refuses with `AI_DISABLED`.

**Verify, unit.**

- [ ] Tests with a fake `ModelPort` cover an invented source id dropped, a private channel the requester left refused, and a call refused while AI is off.
- [ ] An eval script, `apps/server/scripts/eval-summaries.ts`, runs three fixed 50-message threads through the real model and fails when a bullet cites a message that does not support it. Run it once per model change.

**Verify, live.**

- [ ] Operator. Run the exit check in two browsers.

## Close the milestone

- [ ] Every PRD row in M1 reads `Shipped` with its PR link, and the milestone table reads `Shipped`.
- [ ] The exit check passes on `staging`, with the delivery probe's p95 under 200 ms recorded.

## Appendix A. Prototype evidence

None ran yet. The delivery probe is the prototype for the one fact this plan cannot settle by reading. That fact is whether Neon Realtime meets 200 ms p95 from the Vercel region to a browser. Neon publishes no latency numbers for the beta. The rest was read from source and docs on 2026-11-07.

- The API deploys to Vercel as of `5ae09a6` on 2026-11-06. `apps/server/wrangler.jsonc` and `src/worker.ts` keep a Cloudflare Workers build.
- The Neon database is in `ap-southeast-1`, one of the four regions Neon Realtime supports.
- `packages/ui/src/components/message-scroller.tsx` wraps `@shadcn/react/message-scroller` and exposes `scrollAnchor`, the visibility hooks, and the jump button.
- The editor kit has nodes and plugins but no composed editor. `MentionNode` stores a display name only, and `mentions-plugin.tsx` reads from a hardcoded list.
- giabao.dev renders Markdown with `MarkdownAsync`, `remark-gfm`, `rehype-raw`, `rehype-external-links`, and `rehype-pretty-code` with Shiki on the server.

## Appendix B. Decisions

Defaults the owner applies unless the operator says otherwise. The operator accepted decision 5 on 2026-11-07, with the gateway in production and OpenRouter in development. The same day the operator moved the monthly AI cap and usage meter to the backlog, because Conduit will not serve real teams. The operator also made the probe research instead of a PR, and merged threads and DMs into PR3.

1. **Realtime transport.** Neon Realtime, gated by the delivery probe. Socket.IO and the fallback are weighed in Appendix C.
2. **Typing and presence.** Rows in Postgres, delivered by the same live queries. Neon Realtime has no broadcast or presence channel, and a second system for two small features costs more than the writes. PR4 measures the write rate.
3. **DMs are `Channel` rows with `kind: DM`.** Turning a group DM into a channel is then a field change, and channel membership, read access, and the message stream need no second code path. The glossary still calls them DMs, and the contract has its own `dms.*` procedures.
4. **Message bodies are Markdown text.** See the data shapes section.
5. **Model access.** Production uses the Vercel AI Gateway's free credits, $5 every 30 days on the Hobby plan. Development uses OpenRouter's `:free` models, with `provider.data_collection: 'deny'` on every request. They allow 50 requests a day across the account before any purchase, and OpenRouter does not publish each free provider's training policy. The code calls a model id string through `ModelPort`, so switching is a configuration change. M7's AI teammates call the provider SDK directly with the workspace's key.
6. **No monthly cap in M1.** The cap and the usage meter are in the PRD's backlog. If they return, the design is spend in dollars, from tokens times each model's list price, summed per workspace per UTC month and shown to admins as a share of the allowance.
7. **`@json-render` is not part of M1.** `@json-render/chat` renders specs as Slack, Teams, and Discord cards through the Chat SDK, so it does not render inside Conduit. A summary has one fixed shape, which a typed schema and `summary-card.tsx` render. `@json-render/react` with a shadcn catalog is worth a prototype in M5, for suggested task cards, and in M7, for cards that agents post.
8. **Who can delete a message.** Its author, a channel manager, or a workspace admin. Only the author can edit.

## Appendix C. Alternatives rejected

- **Socket.IO on the existing API.** The API runs as Vercel Functions. Vercel's WebSocket support pins each connection to one function instance and, per secondary sources, caps a connection near 5 minutes. Fan-out across instances then needs a Redis adapter, and every message becomes a database write plus a broadcast that can disagree with it. Socket.IO also needs its own auth handshake beside Better Auth's cookie. A long-lived Node host would fix the limits but adds a service to deploy and watch.
- **Socket.IO on a separate long-lived host.** It works and is well known. It is rejected because it adds a server, a Redis instance, and a dual write, while Neon Realtime reads the table Conduit already writes.
- **Fallback if the probe fails. A Cloudflare Durable Object per conversation.** The repo already builds for Workers. A Durable Object holds hibernating WebSockets for one conversation, and the API posts each committed change to it. It also gives typing and presence a broadcast channel. Only `LiveQueries` and `useLiveStream` change.
- **Polling.** It cannot meet 200 ms without a request per client every 200 ms.
- **Lexical JSON as the stored body.** Every reader outside the editor would need Lexical to read a message.
- **`MarkdownAsync` and `rehype-pretty-code` as giabao.dev uses them.** They run on the server, and live messages render in the browser. `rehype-raw` would let a member post HTML into everyone's view.
- **The `Message` component from `packages/ui`.** It is shaped as chat bubbles between a user and an assistant. Conduit is a team log where every row has an author, a time, and the same alignment.
- **A separate `Conversation` table over `Channel` and `Dm`.** It needs a migration of every shipped channel feature for no behavior the `kind` field lacks.

## Appendix D. Risks

- **Neon Realtime is beta.** The probe and PR1. The protocol may change, so the code uses the SDK only, behind `LiveQueries` and `useLiveStream`. No latency is published. The probe measures it, and PR1 records it.
- **Neon Realtime pricing after beta is unknown.** PR1. It is free during the beta, with compute and egress billed as usual.
- **Access lags by up to 60 s.** PR1. A removed member keeps a sealed query until it expires. Sealed queries live 60 s and renewals check access, so the lag is bounded. The history API refuses at once.
- **Raw mention syntax.** PR2. A member who types `<@here>` by hand sends a real `@here`. The server only honors it for members who can post, as with the menu.
- **SSRF through link previews.** PR2. The fetcher checks every resolved address and redirect.
- **The 200 ms target includes the API hop.** PR1. The send path is browser to Vercel to Neon to the subscriber. The probe measures the whole path, not just Neon.
- **Typing writes keep compute awake.** PR4. A workspace with anyone online never scales to zero. That is already true for active workspaces.
- **No cap means one workspace can spend the free credits.** PR5. The Arcjet limit per workspace and `maxOutputTokens` bound it. When credits run out, the gateway refuses, and the summary card shows "AI is unavailable right now."
- **Free credits can fail.** PR5. Vercel community reports describe Hobby credits that did not renew, a card required to unlock them, and free credits blocked from some models.

## Appendix E. Reading list

- `PRD.md`, M1 section and the AI rules, and `GLOSSARY.md`, conversations and AI.
- [`m1-messaging-ui.md`](m1-messaging-ui.md) before any client commit.
- `packages/contract/src/lib/channel-policy.ts` for read and post access.
- `apps/server/src/channels/` as the model for a feature's four layers.
- `packages/ui/src/components/message-scroller.tsx` and the `@shadcn/react/message-scroller` docs.
- `apps/client/src/components/editor/` for the kit the composer uses.
- `D:/dev/giabao.dev/apps/web/components/app/markdown.tsx`, `lib/rehype-code-block.ts`, and `components/doc/mdx/mdx-code-block.tsx`.
- Neon Realtime docs, the [launch post](https://neon.com/blog/neon-now-has-realtime) and the [queries guide](https://neon.com/docs/realtime/guides/queries).
