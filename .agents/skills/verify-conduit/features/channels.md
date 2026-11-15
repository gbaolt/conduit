# Channels

A member creates a channel from the sidebar and is taken into it. The channel stays listed in the sidebar's Channels section. A member can also browse the workspace's channels.

## Sub-features

- `create-public` creates a public channel and opens `/channels/<id>`.
- `create-private` creates a channel with `Make private` checked.
- `name-rules` limits names to lowercase letters, numbers, hyphens, and underscores. A taken name shows `NAME_TAKEN` inline.
- `browse` lists the workspace's channels through `Browse channels`.
- `channel-actions` puts rename, archive, and delete under `Actions for #<name>`.

## How to get to it (user POV)

- In the sidebar, choose the button `Add channels`, then the menuitem `Create a new channel` or `Browse channels`.
- In the sidebar, choose the button `Actions for #<name>` next to a channel, or the same button in the channel header.

## Driving it with drive.py

Preconditions:

- A signed-in account with a workspace. As the owner, it can create public channels.

- **Create.** Run `drive.py run --reuse channel`. It chooses `Add channels`, then `Create a new channel`, which opens the dialog `Create a channel`. It fills the textbox `Name` with `verify-<ts>` and chooses `Create channel`. The URL becomes `/channels/<id>`, and the level-1 heading is the channel name.
- **Persist.** After a reload, `get_by_role("navigation", name="Channels")` has a link with the channel name.
- **Proof.** The screenshots are `create channel dialog`, `new channel open`, and `channel in sidebar after reload`.

## Gotchas

- `Create channel` stays disabled until the name passes validation, which runs on change.
- A member without the permission to create public channels sees "this channel will be private" in place of the `Make private` checkbox. The journey's account is the owner, so it never sees this.
- Channels the journey creates stay in the test workspace in the shared dev database.
- A channel with unread messages has the sidebar link name `<name> , unread`, so an exact-name match fails once someone else posts.
- Right after sign-in, the sidebar renders a `Workspace` placeholder with an empty channel list for a moment, even after the network goes idle. Wait for the workspace's name before looking for channel links.
