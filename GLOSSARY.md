# Conduit

All-in-one communication for teams. Tenancy is a workspace in the product and an organization in auth.

## Language

### Workspaces and people

**Workspace**:
The tenant a person works in. This is the word in the product UI.
_Avoid_: Team (as the tenant), company, account, org (in UI copy)

**Organization**:
The same tenant in the auth schema and Better Auth API (`organization`, `member`, `invitation`).
_Avoid_: Using this word in UI copy

**Member**:
A user who belongs to a workspace, with one of owner, admin, or member.
_Avoid_: User (when you mean workspace membership), teammate

**Deactivated member**:
A member whose access to one workspace is switched off by an admin. They keep their account, their other workspaces, and their channel memberships here, but cannot open or change anything in this workspace until an admin reactivates them. Removing a member is different: it deletes the membership.
_Avoid_: Suspended, banned, disabled user

**Invitation**:
A pending offer for an email address to join a workspace.
_Avoid_: Invite link (the invitation is the record; the link is how it is delivered)

**Join link**:
A shareable URL that lets anyone who opens it join one workspace as a member, without an invitation. An admin can reset it, which stops every old URL working. It is not an Invitation record.
_Avoid_: Invite link, invitation link

**Allowed domain**:
An email domain an admin lists so that people with a verified address on exactly that domain can join the workspace without an invitation. A subdomain such as `eng.acme.dev` does not match `acme.dev`.
_Avoid_: Whitelisted domain, company domain

**Agent**:
An AI teammate added to conversations, where their Members can @mention it and work with it. It is not a Member. It has no workspace role and is not counted as one. An agent is either a **built-in agent** or a **connected agent**.
_Avoid_: Bot, assistant, AI member

### Conversations

**Conversation**:
A channel or a DM. Any place where messages are posted is a conversation.
_Avoid_: Chat, room

**Channel**:
A named conversation space inside a workspace, public or private, shown as `#name`. Names are plain ASCII.
_Avoid_: Team, room

**Channel manager**:
A channel member who can rename, archive, and manage that channel's people. A per-channel role, separate from the workspace role.
_Avoid_: Channel admin, channel owner (owner and admin are workspace roles)

**Default channel**:
The one channel every workspace has, `#all-<workspace-name>`. Every member is in it, and nobody can leave, archive, delete, or make it private.
_Avoid_: General, main channel

**Section**:
A person's own named group of channels in the sidebar. Sections are per user, and no one else sees them.
_Avoid_: Folder, category

**DM**:
A conversation between specific Members with no name: one-on-one, a group DM of up to 10 people, or a Member alone.
_Avoid_: Direct chat, private message

**Message**:
One post in a conversation, written in Markdown text. Its author can edit it, and its author, a channel manager, or a workspace admin can delete it.
_Avoid_: Post, chat

**Mention**:
A message that names a Member, `@channel`, or `@here`. It stores the Member's id, so a rename does not break it. A mention of someone outside the conversation stays plain text.
_Avoid_: Tag, ping

**Reaction**:
An emoji a Member puts on a message. A message holds at most 50 different emoji, and each Member reacts with an emoji once.
_Avoid_: Emoji response, like

**Pin**:
A message kept in a conversation's pinned list. Any Member who can post in the conversation can pin and unpin.
_Avoid_: Star, bookmark (for a message)

**Saved message**:
A message a Member kept for themselves with **Save for later**. Only that Member sees it, on the Saved page.
_Avoid_: Bookmark, favorite

**Thread**:
The replies to one root, where the root is a message or a task. A reply stays in the thread unless its author also sends it to the channel.
_Avoid_: Reply chain, comments (for a thread on a task)

### Work

**Canvas**:
A document several people edit together, in a channel's tab or shared with chosen people.
_Avoid_: Doc, note, page

**Board**:
A set of columns and tasks, in a channel's tab or shared with chosen people. Kanban is the feature; a board is the thing.
_Avoid_: Kanban (as a noun for the thing), project, list

**Column**:
A named stage on a board.
_Avoid_: Lane, status

**Task**:
One piece of work on a board.
_Avoid_: Card, ticket, issue

### Workflows

**Workflow**:
A trigger followed by steps that Conduit runs without anyone doing them by hand.
_Avoid_: Automation, rule, recipe

**Trigger**:
The event that starts a workflow.

**Step**:
One action in a workflow.

**Run**:
One time a workflow ran, from start to finish.

### Attention

**Activity**:
A Member's feed of what needs their attention: mentions, thread replies, reactions to their messages, and channel adds.
_Avoid_: Inbox, notifications (for the feed)

**Notification**:
A push or email that tells a Member about something in their Activity.
_Avoid_: Alert, ping

### AI

**Summary**:
A short AI account of a thread, a channel over a time range, or everything a Member hasn't read (a **catch-up**). Only the Member who asked sees it until they share it.

**Suggested task**:
A task the AI drafts from a promise in a message. It is not on a board until a Member accepts it.

**Decision**:
A message the AI marks as a decision. Decisions appear in their channel's decision log.
