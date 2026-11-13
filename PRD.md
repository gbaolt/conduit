# Conduit product requirements

Conduit is team chat with the work built in. Workspaces, channels, threads, and DMs hold the conversation. Canvas, Kanban, and Workflows hold the work that comes out of it. An AI layer connects the two. It catches you up, turns promises and decisions into tasks, and answers questions from what your team already wrote.

Last updated 2026-11-04.

## How to use this document

This file is the project tracker. Every sub-feature has an ID, a status, and the PR that shipped it.

- A status is one of `Not started`, `In progress`, or `Shipped`.
- The PR that changes a sub-feature's status updates this file in the same diff. A PR that ships a sub-feature without updating this file fails review.
- This file says what each feature does and why. A feature that needs design work gets its own `docs/plans/<feature>.md` for how.
- To add, cut, or move a sub-feature, open a PR against this file. Review it like code.
- Domain words follow [`GLOSSARY.md`](GLOSSARY.md). A new term goes there first.

## Who Conduit is for

Conduit is for product teams and startups of 5 to 50 people who use it as their main chat. It is built to launch to real teams, so admin controls and metrics are in scope. Billing is not.

## What Slack doesn't do

Slack keeps conversation and work in separate places, and its AI sits beside both. In Conduit, the AI reads the conversation and acts on the work:

- **Catch me up** summarizes everything unread since your last visit, with a link to every source message.
- **Summaries** cover a thread or a channel over a time range, on demand.
- **Smart Activity** ranks mentions and replies by urgency and folds the noise together.
- **Actions and decisions** spots lines like "I'll fix login by Friday" and offers a task on the channel's board with the assignee and due date filled in. Decisions go into a log for the channel.
- **Thread to canvas** drafts a spec or meeting notes from a discussion.
- **Ask Conduit** answers questions from the messages, canvases, and files you can access, and cites each source.
- **Plain-English workflows** builds a workflow from a description like "when someone posts 'bug' in #support, add a task to the Bugs board".
- **AI teammates** are agents you add to a conversation. Anyone in that conversation can @mention an agent in a thread, and it replies there.

## Not now

These are out of scope. Don't start them without a PR that moves them into a milestone.

- Huddles, voice calls, and video calls.
- An app marketplace. The agent API in M7 is the only integration point.
- Shared channels between workspaces.
- Enterprise features: SAML SSO, retention policies, and eDiscovery.
- Native mobile apps. The web app works on a phone screen instead.
- Billing and plans. Every workspace is free, with a cap on storage.
- A monthly AI usage cap per workspace, and a usage meter. Conduit is not serving real teams yet.
- UI languages other than English.

## Quality targets for every feature

Each milestone's exit check tests against these targets.

- A sent message appears on other open clients in under 200 ms at p95 on a normal connection.
- Every screen meets WCAG 2.2 AA, and every action works from the keyboard.
- Every screen supports the light and dark themes.
- Every screen works on a 360 px wide phone screen.
- The UI is in English.

## AI rules

These rules apply to every AI feature, including the ones listed under AI later.

- The AI reads only what the member who asked can read. That includes the private channels and DMs they belong to.
- AI output is visible only to the member who asked, until they click **Share to thread**.
- Every summary and answer links to the messages it used.
- A workspace admin can turn AI off for the whole workspace.
- Conduit never uses workspace data to train a model.
- Conduit pays for the built-in AI features on its own model account.
- AI teammates run on an API key the workspace provides, or on the team's own servers. Anthropic's terms bar third-party apps from using Claude Free, Pro, or Max logins, so members can't connect a consumer subscription.

## Success metrics

Targets get set once M2 ships and there is a baseline to measure against.

| Metric                                            | What it shows                         |
| ------------------------------------------------- | ------------------------------------- |
| Weekly active members per workspace               | Teams keep using Conduit              |
| Share of messages that get a reply within 4 hours | Conversations move                    |
| Days per week an active member opens Conduit      | Conduit is the team's main chat       |
| Catch-ups opened per active member per week       | Catch me up saves people time         |
| Share of suggested tasks that members accept      | Actions and decisions finds real work |

## Current stack

- A pnpm and Turborepo monorepo. `apps/client` is the Next.js app and `apps/server` is the NestJS API.
- The API contract lives in `packages/contract` as oRPC procedures. `apps/server` implements it.
- Better Auth handles sign-in and tenancy. A workspace is a Better Auth organization.
- Prisma 7 talks to Postgres on Neon. The schema is `apps/server/database/schema.prisma`.
- Arcjet protects the Nest API and the Better Auth routes.
- `packages/ui` holds the shared components, including `Message` and `MessageScroller`. A Lexical editor kit lives in `apps/client/src/components/editor/`.
- Files will be stored in S3.

Nothing yet handles file storage, search, or AI calls. Messages are stored in Postgres and delivered live through Neon Realtime.

## Milestones

Each milestone ships its core features first, then the AI feature that depends on them.

| Milestone                                  | Core features                            | AI feature                  | Status      |
| ------------------------------------------ | ---------------------------------------- | --------------------------- | ----------- |
| [Foundations](#foundations)                | Sign-in, workspaces, channels, sections  | None                        | Shipped     |
| [M0](#m0-workspace-admin)                  | Invitations, member management, settings | None                        | Shipped     |
| [M1](#m1-messaging)                        | Messages, threads, DMs, realtime         | Summaries                   | Shipped     |
| [M2](#m2-activity-and-notifications)       | Activity feed, notifications             | Smart Activity, Catch me up | Not started |
| [M3](#m3-files-and-search)                 | Files, search, quick switcher            | Ask Conduit                 | Not started |
| [M4](#m4-canvas)                           | Canvas                                   | Thread to canvas            | Not started |
| [M5](#m5-kanban)                           | Kanban boards                            | Actions and decisions       | Not started |
| [M6](#m6-workflows)                        | Workflows                                | Plain-English workflows     | Not started |
| [M7](#m7-admin-analytics-and-ai-teammates) | Admin analytics                          | AI teammates                | Not started |

## Foundations

These features shipped before this document existed. Rows without a PR landed as direct commits.

| ID   | Sub-feature                                                             | Status  | PR                                                 |
| ---- | ----------------------------------------------------------------------- | ------- | -------------------------------------------------- |
| F.1  | Sign up and sign in with email and password, or with OAuth              | Shipped | No PR                                              |
| F.2  | Email verification with a one-time code, and password reset             | Shipped | No PR                                              |
| F.3  | Create, list, and switch workspaces, with onboarding                    | Shipped | No PR                                              |
| F.4  | Accept an invitation to a workspace                                     | Shipped | No PR                                              |
| F.5  | Arcjet protection on the Nest API and the Better Auth routes            | Shipped | No PR                                              |
| F.6  | The channel model and the default channel                               | Shipped | [#28](https://github.com/chef0111/conduit/pull/28) |
| F.7  | The core channel API                                                    | Shipped | [#29](https://github.com/chef0111/conduit/pull/29) |
| F.8  | The resizable channel sidebar and the channel page                      | Shipped | [#30](https://github.com/chef0111/conduit/pull/30) |
| F.9  | Create, browse, rename, copy, leave, and delete channels                | Shipped | [#31](https://github.com/chef0111/conduit/pull/31) |
| F.10 | Archive a channel and switch it between public and private              | Shipped | [#32](https://github.com/chef0111/conduit/pull/32) |
| F.11 | Channel details, with topic, description, members, and channel managers | Shipped | [#33](https://github.com/chef0111/conduit/pull/33) |
| F.12 | Star channels and group them into sidebar sections                      | Shipped | [#34](https://github.com/chef0111/conduit/pull/34) |

## M0 Workspace admin

A team can't try messaging until more than one person can get in. Today a member can accept an invitation, but nothing in the app sends one.

| ID   | Sub-feature                                                            | Status  | PR                                               |
| ---- | ---------------------------------------------------------------------- | ------- | ------------------------------------------------ |
| M0.1 | Invite people by email                                                 | Shipped | [#55](https://github.com/gbaolt/conduit/pull/55) |
| M0.2 | Invite people with a shareable link that an admin can reset            | Shipped | [#56](https://github.com/gbaolt/conduit/pull/56) |
| M0.3 | Revoke a pending invitation                                            | Shipped | [#55](https://github.com/gbaolt/conduit/pull/55) |
| M0.4 | Remove a member from the workspace                                     | Shipped | [#54](https://github.com/gbaolt/conduit/pull/54) |
| M0.5 | Deactivate and reactivate a member                                     | Shipped | [#54](https://github.com/gbaolt/conduit/pull/54) |
| M0.6 | Change a member's role to owner, admin, or member                      | Shipped | [#54](https://github.com/gbaolt/conduit/pull/54) |
| M0.7 | Edit the workspace name, icon, and URL slug                            | Shipped | [#57](https://github.com/gbaolt/conduit/pull/57) |
| M0.8 | Choose who can create channels and who can create public channels      | Shipped | [#57](https://github.com/gbaolt/conduit/pull/57) |
| M0.9 | Let people with an email on a listed domain join without an invitation | Shipped | [#56](https://github.com/gbaolt/conduit/pull/56) |

**Exit check.** An admin invites a new person by email. That person joins from the email, and the admin changes their role and then removes them, all from the UI.

## M1 Messaging

Every other feature reads or writes messages, so messaging comes first.

| ID    | Sub-feature                                                                             | Status  | PR                                               |
| ----- | --------------------------------------------------------------------------------------- | ------- | ------------------------------------------------ |
| M1.1  | Deliver messages in realtime to every open client                                       | Shipped | [#59](https://github.com/gbaolt/conduit/pull/59) |
| M1.2  | Send, edit, and delete messages                                                         | Shipped | [#59](https://github.com/gbaolt/conduit/pull/59) |
| M1.3  | Rich text with Markdown shortcuts, built on the Lexical kit                             | Shipped | [#59](https://github.com/gbaolt/conduit/pull/59) |
| M1.4  | Mention a person, `@channel`, or `@here`                                                | Shipped | [#61](https://github.com/gbaolt/conduit/pull/61) |
| M1.5  | Emoji reactions                                                                         | Shipped | [#61](https://github.com/gbaolt/conduit/pull/61) |
| M1.6  | Threads, with **Also send to channel**                                                  | Shipped | [#62](https://github.com/gbaolt/conduit/pull/62) |
| M1.7  | Unread markers, and remembering where each member stopped reading                       | Shipped | [#60](https://github.com/gbaolt/conduit/pull/60) |
| M1.8  | Typing indicators                                                                       | Shipped | [#60](https://github.com/gbaolt/conduit/pull/60) |
| M1.9  | Online and away status                                                                  | Shipped | [#60](https://github.com/gbaolt/conduit/pull/60) |
| M1.10 | Keep a saved draft for each conversation                                                | Shipped | [#60](https://github.com/gbaolt/conduit/pull/60) |
| M1.11 | Pin messages to a conversation                                                          | Shipped | [#61](https://github.com/gbaolt/conduit/pull/61) |
| M1.12 | **Save for later** on any message                                                       | Shipped | [#61](https://github.com/gbaolt/conduit/pull/61) |
| M1.13 | Link previews                                                                           | Shipped | [#61](https://github.com/gbaolt/conduit/pull/61) |
| M1.14 | One-on-one DMs                                                                          | Shipped | [#62](https://github.com/gbaolt/conduit/pull/62) |
| M1.15 | Group DMs of up to 10 people, including you                                             | Shipped | [#62](https://github.com/gbaolt/conduit/pull/62) |
| M1.16 | **Turn into a private channel**, offered when someone adds an 11th person to a group DM | Shipped | [#62](https://github.com/gbaolt/conduit/pull/62) |
| M1.17 | A DM with yourself, for notes                                                           | Shipped | [#62](https://github.com/gbaolt/conduit/pull/62) |
| M1.18 | AI: summarize a thread, or a channel over a time range                                  | Shipped | [#63](https://github.com/gbaolt/conduit/pull/63) |
| M1.19 | AI admin control: turn AI on or off for the workspace                                   | Shipped | [#63](https://github.com/gbaolt/conduit/pull/63) |

File attachments ship in M3, together with file storage. An edited message shows no "(edited)" mark.

**Exit check.** Two members in different browsers exchange channel messages, thread replies, reactions, and DMs. Delivery meets the 200 ms p95 target. A summary of a 50-message thread links to the messages it used.

## M2 Activity and notifications

Members need to know what needs them without reading every channel.

| ID   | Sub-feature                                                                                  | Status      | PR  |
| ---- | -------------------------------------------------------------------------------------------- | ----------- | --- |
| M2.1 | An Activity feed with mentions, thread replies, reactions to your messages, and channel adds | Not started |     |
| M2.2 | **All** and **Unread** filters, and **Mark all read**                                        | Not started |     |
| M2.3 | Set notifications per channel to all messages, mentions only, or nothing                     | Shipped     |     |
| M2.4 | Mute a channel                                                                               | Shipped     |     |
| M2.5 | Do Not Disturb, on a schedule or as a snooze                                                 | Shipped     |     |
| M2.6 | Browser push notifications                                                                   | Not started |     |
| M2.7 | An email digest of unread mentions after a member has been away for 1 hour                   | Not started |     |
| M2.8 | AI: Smart Activity ranks the feed by urgency and folds the noise together                    | Not started |     |
| M2.9 | AI: Catch me up summarizes everything unread since your last visit                           | Not started |     |

**Exit check.** A member who was away opens Conduit. Catch me up shows what they missed with a link to each source, and the Activity feed puts a direct question to them above reactions to their messages.

## M3 Files and search

Teams share files in chat and need to find old answers. Ask Conduit answers from the same index that search uses.

| ID    | Sub-feature                                                                            | Status      | PR  |
| ----- | -------------------------------------------------------------------------------------- | ----------- | --- |
| M3.1  | Upload by dragging, pasting, or picking a file. The browser uploads straight to S3.    | Not started |     |
| M3.2  | Attach files to messages                                                               | Not started |     |
| M3.3  | Preview images, video, and PDFs inside the message                                     | Not started |     |
| M3.4  | A **Files** page with every file you can access, filtered by channel, person, and type | Not started |     |
| M3.5  | Cap each file at 50 MB                                                                 | Not started |     |
| M3.6  | Cap each workspace at 10 GB, and stop uploads at the cap with a message that says why  | Not started |     |
| M3.7  | Search messages, files, channels, and people                                           | Not started |     |
| M3.8  | Search filters: `in:`, `from:`, `has:file`, `before:`, and `after:`                    | Not started |     |
| M3.9  | A `Ctrl+K` quick switcher to jump to any channel or DM                                 | Not started |     |
| M3.10 | Show only results the member can access                                                | Not started |     |
| M3.11 | AI: Ask Conduit answers questions and cites each source                                | Not started |     |

**Exit check.** A member uploads a PDF to a private channel. A member outside that channel can't find it in search or on the **Files** page, and Ask Conduit doesn't use it in their answers.

## M4 Canvas

Some talk needs to become a document that people keep editing. A canvas is attached to a channel by default.

| ID   | Sub-feature                                                                   | Status      | PR  |
| ---- | ----------------------------------------------------------------------------- | ----------- | --- |
| M4.1 | Create a canvas as a channel tab, or on its own and shared with chosen people | Not started |     |
| M4.2 | Several people edit at once, and each person's cursor shows                   | Not started |     |
| M4.3 | Comment on selected text                                                      | Not started |     |
| M4.4 | Mentions and checklists                                                       | Not started |     |
| M4.5 | Embed a message in a canvas                                                   | Not started |     |
| M4.6 | Version history                                                               | Not started |     |
| M4.7 | AI: turn a thread into a canvas draft                                         | Not started |     |

Later: canvas templates, and export to PDF or Markdown.

**Exit check.** Two members edit the same canvas at once without losing each other's changes. A thread turned into a canvas keeps a link to every message it drew from.

## M5 Kanban

Tasks that come out of chat need somewhere to live. A board is attached to a channel by default, so Actions and decisions always has a board to put tasks on.

| ID   | Sub-feature                                                                         | Status      | PR  |
| ---- | ----------------------------------------------------------------------------------- | ----------- | --- |
| M5.1 | Create a board as a channel tab, or on its own and shared with chosen people        | Not started |     |
| M5.2 | Rename and reorder columns, and drag tasks between them                             | Not started |     |
| M5.3 | A task has a title, a description, an assignee, a due date, labels, and a checklist | Not started |     |
| M5.4 | A task's discussion is a regular thread, so its replies show up in Activity         | Not started |     |
| M5.5 | A task made from a message links back to that message                               | Not started |     |
| M5.6 | Filter a board by assignee, label, and due date                                     | Not started |     |
| M5.7 | Embed a task in a canvas                                                            | Not started |     |
| M5.8 | AI: suggest a task from a promise in chat, and log each decision for its channel    | Not started |     |

Later: WIP limits, swimlanes, and custom fields.

**Exit check.** A member writes "I'll ship the invite flow by Friday" in a channel. Conduit suggests a task on that channel's board with the member as assignee and Friday as the due date. One click adds it.

## M6 Workflows

Teams repeat the same steps by hand. Workflows run them on a trigger.

| ID   | Sub-feature                                                                                                                             | Status      | PR  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --- |
| M6.1 | Triggers: a message that matches some text, an emoji reaction, a member joining a channel, a schedule, a task moving, a form submission | Not started |     |
| M6.2 | Steps: send a message, send a DM, create or move a task, ask the AI to summarize or sort, wait for approval, open a form                | Not started |     |
| M6.3 | Build a workflow by hand                                                                                                                | Not started |     |
| M6.4 | Review every step before turning a workflow on                                                                                          | Not started |     |
| M6.5 | A log of every run                                                                                                                      | Not started |     |
| M6.6 | AI: build a workflow from a plain-English description                                                                                   | Not started |     |

**Exit check.** A member describes "when someone reacts with :bug: in #support, add a task to the Bugs board". Conduit shows the steps, the member turns it on, and the next :bug: reaction creates a task and shows in the run log.

## M7 Admin analytics and AI teammates

Admins need to see how their workspace uses Conduit. AI teammates need the boards and workflows from M5 and M6 to be useful.

| ID   | Sub-feature                                                                                                     | Status      | PR  |
| ---- | --------------------------------------------------------------------------------------------------------------- | ----------- | --- |
| M7.1 | An analytics page: active members, messages per channel, busiest channels, AI usage, and storage use            | Not started |     |
| M7.2 | Built-in agents: an admin sets a name, instructions, and a model, and they run on the workspace's API key       | Not started |     |
| M7.3 | Connected agents: the team's own agent connects through a Conduit agent API and MCP server                      | Not started |     |
| M7.4 | An admin adds an agent to the workspace, and a member adds it to a conversation                                 | Not started |     |
| M7.5 | @mention an agent in a thread. It reads only the conversations it has been added to, and replies in the thread. | Not started |     |
| M7.6 | Later replies in a thread reach the agent without another mention                                               | Not started |     |

**Exit check.** A team connects its own agent. A member @mentions it in a thread and it replies there. It can't read a conversation it hasn't been added to.

## AI later

These ideas wait until the must-have AI features ship:

- **Already answered.** Before you post a question, the message box shows an answer that already exists.
- **Who knows about X.** Finds people by what they have written. Needs a privacy review first.
- **Unanswered questions.** Brings up questions nobody has replied to after a set number of hours.
- **Writing help.** Rewrite, shorten, change tone, or fix grammar in the message box.
- **Translation for each reader.** Each member reads messages in their own language.
- **Focus mode.** Holds back notifications unless the AI judges them urgent.
- **Auto standup.** Drafts your daily update from the tasks you moved and the messages you sent.
- **Agents that do work.** Assign a task to an agent, or use an agent as a workflow step.

## Open questions

- The 10 GB storage cap for each workspace is a placeholder.
- The 4-hour reply window in the success metrics is a placeholder.
- The 1-hour wait before the email digest is a placeholder.
