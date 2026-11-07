# M1 messaging UI guideline

This is how the conversation screen looks and behaves. It applies to channels, DMs, the self DM, and the thread panel, which all share one set of components. The build steps live in [`m1-messaging.md`](m1-messaging.md).

The conversation is a working screen, read many times a day for hours at a time. It follows the app-screen rules of the design-taste skill. Colour goes on meaning, not chrome. Surfaces are flat. The newest content and the place to reply are always in view. No new direction was drawn, because the shell already sets one. It uses Geist, the zinc neutrals, the blue `--primary`, and the shadcn primitives in `packages/ui`. This guideline adds no tokens.

## The screen's one question

"What changed here since I last looked, and how do I answer?" That decides three things.

- **Biggest.** The message log fills every pixel between the channel header and the composer.
- **First in reading order.** The **New** marker, or the newest message when nothing is unread.
- **Left out.** No member list, no channel details, and no files rail beside the log. Those stay in the existing details dialog.

## Layout

```
┌ sidebar ┬──────────────────────────────── conversation ─┬─ thread (optional) ─┐
│         │ # design   Topic text…            Pinned 2  ⋯ │ Thread   #design  ✕ │
│         │──────────────────────────────────────────────│ root message        │
│         │  Today                                        │ 3 replies           │
│         │  (A) Linh Tran  9:41                          │ reply               │
│         │      Message body…                            │ reply               │
│         │      Second message, grouped                  │                     │
│         │  ──────────────── New ──────────────────────  │                     │
│         │  (B) Bao Le  9:52                             │                     │
│         │      Body with `code` and a link              │                     │
│         │      [👍 2] [🎉 1] [+]                         │                     │
│         │      3 replies  Last reply 10:04              │                     │
│         │                                       (↓)     │ [ ] Also send to #… │
│         │ ┌──────────────────────────────────────────┐  │ ┌─────────────────┐ │
│         │ │ Message #design                          │  │ │ Reply…          │ │
│         │ │ B  I  S  🔗  <>  •  ▭           ➤ Send   │  │ └─────────────────┘ │
│         │ └──────────────────────────────────────────┘  │                     │
│         │ Linh is typing                                │                     │
└─────────┴──────────────────────────────────────────────┴─────────────────────┘
```

- The conversation column has no max width. Message text stops at 72ch inside it, so long lines stay readable on a wide screen.
- The column's side padding is 20 px on desktop and 16 px on a phone. The composer uses the same edges as the messages.
- The thread panel opens on the right in the existing `resizable` group, 380 px by default, 320 px minimum, and pushes the log narrower rather than covering it.

## Message rows

Rows are a flat log. There are no bubbles, no left and right alignment, and no card per message. Each row is a `MessageScrollerItem`.

| Part            | Spec                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Avatar          | 36 px, `rounded-md`, from `UserAvatar`. Only on the first row of a group. A grouped row leaves the 36 px column empty and shows its time there, 11 px muted, on hover and focus.                             |
| Name line       | Name 14 px semibold in `--foreground`, then the time 12 px `--muted-foreground` with tabular figures, 8 px apart. The time is a `<time>` element whose title holds the full date.                            |
| Body            | 14 px, line height 22 px, `--foreground`. Running text is never grey.                                                                                                                                        |
| Grouping        | Consecutive messages by one author within 5 minutes, with no day divider or **New** marker between them. Group top padding 8 px, grouped rows 2 px.                                                          |
| Pitch           | A single-line ungrouped row is about 52 px. A grouped one-liner is 24 px.                                                                                                                                    |
| `(edited)`      | 12 px muted, after the body text.                                                                                                                                                                            |
| Hover and focus | The row takes `--muted` as its background, with no border and no shadow. The action bar appears top right, 8 px in, as a small floating toolbar. It is the one shadowed thing on the row, because it floats. |
| Action bar      | React, Reply in thread, Save for later, and a `⋯` menu with Pin, Copy link, Edit, and Delete. 28 px icon buttons, 16 px outline icons from Tabler, each with a tooltip and an `aria-label`.                  |

### Day dividers and the New marker

- A day divider is a 1 px `--border` line with a centred 12 px medium label on the ground: "Today", "Yesterday", or "Tuesday, November 4". It is sticky at the top of the viewport while its day scrolls.
- The **New** marker is a 1 px line in `--destructive` with a right-aligned 12 px label "New" in the same colour. It is the only red on the screen. It stays until the member leaves the conversation, so returning shows what was new.

### Inline content

| Element                             | Spec                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mention of a person                 | `@Name` in 14 px medium, `--primary` text on a 10% `--primary` tint, radius 4 px, 2 px horizontal padding. Hover shows a card with name, role, and presence.                                                                                                                                                                    |
| Mention of you, `@channel`, `@here` | The whole row takes a 6% `--primary` tint and a 2 px `--primary` bar on its left edge. This is the one place the accent marks a row.                                                                                                                                                                                            |
| Link                                | `--primary`, underlined on hover only. External links get `rel="noopener nofollow"` and open in a new tab.                                                                                                                                                                                                                      |
| Inline code                         | 13 px Geist Mono on `--muted`, radius 4 px, 4 px padding.                                                                                                                                                                                                                                                                       |
| Code block                          | `CodeBlock` from `apps/client/src/components/code-block.tsx`, ported from giabao.dev. A 1 px `--border` frame, radius `--radius-md`, a header with the language and copy and wrap buttons, 13 px mono, max height 360 px with its own scroll. Highlighting uses the github light and dark themes with no background of its own. |
| Block quote                         | 3 px `--border` bar on the left, text in `--foreground`.                                                                                                                                                                                                                                                                        |
| Lists                               | Native `ul` and `ol`, 20 px indent.                                                                                                                                                                                                                                                                                             |
| Headings in Markdown                | Rendered as a bold paragraph at body size. A chat row never shows a 24 px title.                                                                                                                                                                                                                                                |
| Link preview                        | Under the body, max width 480 px. A 3 px `--border` bar on the left, site name 12 px muted, title 14 px semibold `--primary`, description 13 px two lines then an ellipsis, and the image at 80 px square on the right when one exists. No border box and no shadow.                                                            |

### Reactions and the thread line

- A reaction is a pill 24 px tall, radius full, 1 px `--border`, with the emoji and a tabular count. When you reacted, it takes a 10% `--primary` tint and a `--primary` border. Its tooltip names who reacted, as in "Linh, Bao, and 3 others".
- The `+` pill opens the emoji picker that the editor kit already ships.
- The thread line sits under the body. It shows up to three repliers' 20 px avatars, "3 replies" in 13 px medium `--primary`, and "Last reply 10:04" in 12 px muted. The whole line is one button that opens the thread.

### Deleted and failed messages

- A deleted message with replies keeps its row as "This message was deleted." in 14 px muted italic, with no avatar change. A deleted message without replies leaves the log.
- An optimistic message shows at full opacity at once, with no spinner. If it is not confirmed in 3 s, its time is replaced by "Sending…" in muted text. If the send fails, the row shows "Not sent." in `--destructive` with **Retry** and **Delete** text buttons.

## The composer

`composer.tsx` is one component for the channel, the DM, the thread, and editing in place.

- **Frame.** A 1 px `--input` border, radius `--radius-lg`, and the `--background` fill. Focus shows the `--ring` outline. The composer is the only surface on the screen with a resting shadow, a small one under 8% black, because it floats over the log's end.
- **Placeholder.** "Message #design", "Message Linh Tran", "Reply…", or "Jot a note…" for the self DM.
- **Height.** One line at rest, 44 px. It grows with content up to 40% of the viewport, then scrolls inside.
- **Toolbar.** One row along the bottom inside the frame. It holds bold, italic, strikethrough, link, inline code, bulleted list, numbered list, code block, the emoji button, and `@`. Then the send button sits at the right. Icons are 16 px in 28 px buttons, `--muted-foreground`, and active formats take `--accent`. The kit's font, colour, size, table, column, image, and embed tools are not in the composer.
- **Send button.** 28 px square, `--primary` fill when the body has text, `--muted` and disabled when it is empty. It is the screen's one filled control.
- **Keys.** **Enter** sends. **Shift+Enter** adds a line. In a list or code block, **Enter** continues it and **Enter** on an empty last item leaves it. **Up** in an empty composer edits your last message. **Escape** cancels an edit. **Ctrl+B**, **Ctrl+I**, **Ctrl+Shift+X**, and **Ctrl+K** format.
- **Editing in place.** The row's body is replaced by a composer with the body loaded, and **Cancel** and **Save** text buttons under it. "Escape to cancel, Enter to save" sits beside them in 12 px muted.
- **Length.** At 3,800 of 4,000 characters, a counter appears at the toolbar's right, as in "3,812 / 4,000". It turns `--destructive` past the limit, and send is disabled.
- **Thread composer.** Adds **Also send to #design** as a `Checkbox` with its label under the frame.
- **Typing line.** 20 px tall under the composer, 12 px muted. "Linh is typing", "Linh and Bao are typing", or "Several people are typing". The line keeps its height when empty, so the composer never jumps.

## The thread panel

- A header 48 px tall with "Thread", the conversation name in 13 px muted, and a close button. **Escape** closes it.
- The root message renders as a normal row, followed by a divider labelled "3 replies", then the replies and the thread composer.
- On open, focus moves to the thread composer. On close, focus returns to the thread line that opened it.
- The URL carries `?thread=<id>`, so a thread can be linked and reloaded.

## Summaries

- **Summarize this thread** sits in the thread header's menu. **Summarize channel** sits in the channel header's menu, with a range of the last 24 hours, the last 7 days, or since a chosen date.
- The summary appears as a block at the end of the log or thread, visible only to you. A 6% `--primary` tint fills it, with no border. Its header reads "Summary of 50 messages" with "Only you can see this" in 12 px muted.
- Each bullet is 14 px text followed by its sources as small numbered links, "1 2 3", 12 px `--primary`. A source link scrolls to the message and tints it for 1.5 s.
- **Share to thread** is a secondary button. **Dismiss** is a ghost button.
- While streaming, bullets appear as they arrive, with a blinking caret after the last one. **Stop** replaces **Share** until it ends.
- With AI off, the menu entries are gone. When the provider refuses, the summary block shows "AI is unavailable right now." with a **Retry** text button.

## Presence

- An 8 px dot at the avatar's bottom right, with a 2 px ring in the ground colour. Online is the status green. Away is a hollow ring in `--muted-foreground`. Use `@conduit/ui/components/status` if it matches.
- Presence shows on DM rows in the sidebar, on the hover card, and on the DM header. It does not show on every message avatar, which would scatter colour through the log.
- Every dot has text beside it or an `aria-label`, such as "Online" or "Away".

## The sidebar

- An unread conversation's name turns semibold `--foreground`. A read one stays `--sidebar-foreground` at regular weight. No dots and no counts for plain unread.
- A conversation where you are mentioned shows a count badge at the right, 18 px tall, `--destructive` fill, white tabular figures.
- A pencil icon, 14 px muted, marks a conversation with a draft.
- **Direct messages** is its own section under the channels. Your self DM comes first, named "Bao Le (you)".

## Empty, loading, and error states

- **A new channel.** The log's start shows "This is the very beginning of #design" in 20 px semibold, the channel description under it, and **Add people** as a secondary button. Every later screen keeps this block above the first message.
- **A new DM.** The other members' avatars at 48 px, their names, and "This is the start of your conversation."
- **The self DM.** "Jot notes, drafts, and links here. Only you can see them."
- **Loading.** Skeleton rows at the real pitch, an avatar square, a 120 px name bar, and one or two body bars. The skeleton has no shimmer, matching the existing route skeletons. The composer renders at once and accepts typing.
- **History failed to load.** One line at the top of the log, "Couldn't load earlier messages." with a **Retry** text button.
- **Live connection lost.** A thin line above the composer, "Reconnecting…", in 12 px muted. After 10 s it reads "Offline. Messages will send when you reconnect." Messages sent meanwhile stay optimistic.
- **Archived channel.** The existing archived banner replaces the composer.

## The phone, 360 px and up

- The log fills the screen under a 48 px header with a back button, the conversation name, and one `⋯` menu.
- The thread panel becomes a full screen pushed over the conversation. Back returns to the log at its scroll position.
- Hover actions become a long press, which opens a `Sheet` from the bottom with the reaction row on top and the actions as 44 px rows.
- The composer's toolbar collapses to an **Aa** toggle, emoji, and send. **Aa** shows the formatting row above the composer.
- On a phone, **Enter** adds a line and only the send button sends.
- Touch targets are 44 px. Body text stays 14 px. Nothing scrolls sideways, and a code block scrolls inside its own frame.

## Motion

- A message from someone else enters with opacity 0 to 1 and a 4 px rise over 160 ms, ease-out. Your own optimistic message appears with no motion, so sending feels instant.
- The jump-to-end button uses the transition already in `MessageScrollerButton`.
- A highlighted message, from a source link or a permalink, fades its tint out over 1.5 s.
- The typing line cross-fades its text over 120 ms.
- Under `prefers-reduced-motion`, every move drops its travel and keeps only opacity, and the highlight holds for 1.5 s then clears.

## Accessibility

- The log is `role="log"` with `aria-live="polite"`, so a screen reader announces new messages from others. Your own messages are not announced.
- Each row is an `article` labelled by its author and time. **Tab** moves into the log once. **Up** and **Down** move between messages, and **Enter** on a focused message opens its action bar.
- **Alt+Up** and **Alt+Down** move between conversations, and **Escape** in the log returns focus to the composer.
- Every icon button has an `aria-label` and a tooltip. Every colour signal also carries text. The **New** line says "New", and a failed send says "Not sent."
- Contrast holds at 4.5:1 for text and 3:1 for the composer border and pills in both themes. Check both with the existing tokens before shipping.

## Do not

- Chat bubbles, right-aligned own messages, or the `Message` component from `packages/ui`.
- Colour on names. Every author's name is `--foreground`.
- A gradient, a glow, or glass on any surface.
- Emoji in labels or empty states. Emoji belong in messages and reactions.
- Bouncing dots for typing. The words carry it.
- Toasts for sends, edits, or reactions. The row itself shows the result.
- Uppercase tracked labels on day dividers or headers.
