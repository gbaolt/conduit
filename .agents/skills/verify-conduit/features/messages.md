# Messages

A member types Markdown into a channel's composer and sends it. The message appears in the channel log right away and stays after a reload. Each message has actions on hover.

## Sub-features

- `send-enter` sends with Enter. Shift+Enter starts a new line.
- `send-button` sends with the `Send message` button, which is disabled while the composer is empty.
- `persist` keeps a sent message after a reload.
- `format` renders Markdown, so `**bold**` becomes `<strong>`. The `Formatting` toolbar offers Bold, Italic, Strikethrough, Link, lists, Inline code, and Code block.
- `actions` shows `Add reaction`, `Reply in thread`, `Save for later`, and `More actions` on each message.

## How to get to it (user POV)

- Open a channel from the sidebar (`navigation "Channels"`). `/` redirects to the workspace's default channel.
- Type in the textbox `Message #<channel>` and press Enter, or choose `Send message`.

## Driving it with drive.py

Preconditions:

- A signed-in account with a workspace, from the `account` journey or `--reuse`.

- **Send.** Run `drive.py run --reuse message`. It types into `get_by_role("textbox", name=re.compile(r"^Message #"))` and presses Enter. An `article` holding the text appears in `get_by_role("log")`.
- **Stored.** The article's accessible name changes from `<author>, sending` to `<author>, <time>`, so wait with `expect(article).not_to_have_accessible_name(re.compile("sending"))`.
- **Persist.** After `page.reload()`, the same article is in the log.
- **Format.** The SKILL.md `--script` example sends `**bold** check` and finds `article >> strong` with the text `bold`.
- **Proof.** The screenshots are `composer with typed message`, `message stored`, and `message still there after reload`, and the log is in `NN-message-log.aria.txt`.

## Gotchas

- Reloading before the article loses `, sending` can drop the message, which tests the wrong thing.
- The composer is a Lexical `contenteditable`, so `fill()` does not work. Click it, then `type()`.
- The action buttons on a message appear on hover, but `get_by_role` finds them in the tree without hovering.
- With `NEON_REALTIME_URL` unset, other tabs do not update live, but sending and history still work.
