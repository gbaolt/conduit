# AI summaries

A member asks AI to summarize a channel, a DM, or a thread, or to catch them up on everything unread. The summary streams into a dialog as cited bullets, and only the requester sees it. A channel or thread summary can be shared to the channel. A catch-up can't be shared, and each of its sources opens the room it came from.

## Sub-features

- `channel-summary` summarizes a channel from its header menu, over `Last 24 hours`, `Last 7 days`, or `Pick dates…`.
- `dm-summary` does the same from a DM header as `Summarize conversation`.
- `thread-summary` runs `Summarize this thread` from the thread panel's `Thread actions` menu.
- `stream` streams bullets in while the dialog is `aria-busy="true"` and the footer reads `Stop`. When done, `aria-busy` is `"false"` and the footer reads `Close`.
- `sources` follows a source in a channel summary: it closes the dialog and scrolls the conversation to the cited message.
- `share` posts the summary as a message. `Share to channel` shows a spinner, then `Shared`, then the dialog closes.
- `catch-up` runs `Catch me up` on `/activity`, which summarizes unread messages across rooms under "What you missed since <time>".
- `ai-off` hides every Summarize entry and `Catch me up` while the workspace's AI setting is off.

## How to get to it (user POV)

- In a channel header, open the `Actions for #<channel>` button, then `Summarize channel` and a range.
- Open a thread, then `Thread actions` and `Summarize this thread`.
- On `/activity`, choose `Catch me up`. It is disabled and reads `You're all caught up` when nothing is unread.

## Driving it with drive.py

Preconditions:

- The seeded workspace exists, and `.verify/seed.json` names its viewer and a second member (see SKILL.md, "Seeded workspace"). A fresh `account` workspace has AI off and no history, so it can't drive this feature.
- The server can reach a model. Locally that's OpenRouter through `OPENROUTER_API_KEY`. A model failure shows "Couldn't summarize" with `Retry`.

- **Channel summary.** Run `drive.py run seed summary`. It opens the channel from the sidebar and chooses the header's `Actions for #launch` (the last of the two buttons with that name). It hovers `Summarize channel`, then chooses `Last 7 days`. The dialog heading matches `Summary of N messages` and `aria-busy` turns `"false"`.
- **Sources.** The finished dialog has buttons named `Source 1` … `Source N`. Choosing `Source 1` closes the dialog and highlights the cited message in the log.
- **Catch-up.** Run `drive.py run seed catchup`. On `/activity`, if the button is `You're all caught up`, the journey signs in as the seeded poster, sends a message in the channel, and signs back in as the viewer. It then chooses `Catch me up`. The heading matches `What you missed since <time>`, and a source labelled `Source 1 in #launch` opens `/channels/<id>`.
- **Proof.** The screenshots are `summarize channel menu`, `summary streaming`, `summary done`, `after following a source`, `catch-up done`, and `after following a catch-up source`, with ARIA snapshots of both dialogs.
- **Not driven.** `share` posts a message to the seeded channel on every run, so drive it only when a change touches sharing. The journeys also skip `thread-summary`, `dm-summary`, `Pick dates…`, and `ai-off`.

## Gotchas

- The channel header and the sidebar each have a button named `Actions for #<channel>`. Only the header's menu has `Summarize channel`, so use `.last`.
- A channel summary's sources are `button "Source N"`. A catch-up's sources are labelled `Source N in #room`, and they show a bare number until the cited message loads, a second or more after the dialog finishes. Wait for the label with `get_by_label`. `get_by_role("link")` finds nothing.
- The seeded messages date from 2026-11-14. Once they are more than 7 days old, `Last 7 days` has nothing to summarize, so pick dates or post new messages.
- Catch-up marks nothing read, but opening a channel does. After the `summary` journey opens #launch, catch-up has nothing unread until someone else posts.
- Each summary is a real model call. Each catch-up from an empty state adds a message to the seeded channel.
