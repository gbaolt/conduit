# Ask Conduit as a chat in the side card

PR3 (#98) shipped Ask Conduit as a one-question `Dialog`. This plan turns it into a chat that lives in the side card from [`side-panel.tsx`](../../apps/client/src/components/side-panel.tsx). A member can ask a follow-up such as "and for Pro?", keep the chat open while they read the message it cites, and come back to an earlier chat later.

The work reworks PR #98 in place, so M3.11 ships once in its final shape and the dialog never lands. Commit 1 of PR3 (sentence chunks, `74c9e4c`) stays. Commits 2 and 3 are rewritten as the four commits below. Nothing changes in PR1 or PR2.

The UI follows [shadcn-ui/chatbot-template](https://github.com/shadcn-ui/chatbot-template) (MIT). The server does not. The template is a public Next.js route that receives the whole message list from the browser on every turn. Conduit's server owns the history, checks access on every turn, and stores each answer even when the reader leaves.

## Decisions taken

The operator made these calls on 2026-11-22.

| Question                   | Decision                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Which template             | `shadcn-ui/chatbot-template`                                                                          |
| Does a chat remember turns | Yes. Follow-ups use earlier turns, and every chat is saved with a list of past chats.                 |
| What happens to the dialog | It is deleted. Every entry point opens the side card. `DESIGN.md` gains an exception for Ask Conduit. |
| Where the work lands       | PR #98 is reworked. No fourth PR.                                                                     |

These defaults were applied without asking. Each can be overridden before Commit 2 starts.

1. **The name is `AskChat`, and the UI says "chat".** `GLOSSARY.md` lists "Chat" under _Avoid_ for **Conversation** and **Message**. An **Ask chat** is a different thing (one member and Ask Conduit, seen by nobody else), and "New chat" is what every AI product calls it. The alternative is "Ask session".
2. **The side card keeps a stack.** The newest panel shows, and closing it shows the one under it. So Ask opened over a thread returns to the thread when it closes, and a thread opened from a citation returns to Ask when it closes.
3. **The command menu row and the search page button start a new chat.** The top bar button reopens the last chat.
4. **Stop only stops reading.** The server still finishes and stores the answer, as PR3 does today. Fluid Compute cancels a request whose client leaves, and the server can't tell a Stop from a closed tab. The turn shows "Stopped", and the full stored answer replaces it the next time the chat loads.
5. **A not-found answer and a failed turn render inside the transcript, as part of their turn.** `DESIGN.md` says error and no-results states are a centred `Empty`. In a chat that would hide the earlier turns. A chat with no turns still shows a centred `Empty`.

## What the template gives us, and what it doesn't

| Template part                                      | In Conduit                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `MessageScroller` and its parts (`@shadcn/react`)  | Already in `packages/ui/src/components/message-scroller.tsx`, and used by the conversation log. Reused as is.     |
| `Message`, `MessageContent`, `MessageFooter`       | Already in `packages/ui/src/components/message.tsx`, with a `bubble` variant. Reused as is.                       |
| `Bubble` (the question's muted surface)            | Missing. Added to `packages/ui` with the shadcn CLI, or copied from the template if the registry has no `bubble`. |
| `Collapsible` (the "N sources" drawer)             | Missing. Added to `packages/ui` with the shadcn CLI. It builds on `@base-ui/react`, which is installed.           |
| `PromptForm` (textarea, Enter sends, Stop)         | Rebuilt on `InputGroupTextarea`, which exists.                                                                    |
| `MessageActions` (Copy, Retry)                     | Copy only, through the existing copy-state component. Retry shows only on a failed turn.                          |
| `Trace` "Thinking" line                            | Replaced by `AILoader` and shimmer text, per `DESIGN.md`.                                                         |
| `useChat` from `@ai-sdk/react`, and `/api/chat`    | Not used. See Appendix B.                                                                                         |
| Model picker, web search, `ask_user` questionnaire | Not used. Ask Conduit has one model and one tool-free job.                                                        |
| `Suggestions`                                      | Skipped. Fixed example prompts would name topics the workspace may not have.                                      |

No new npm package is needed. The two shadcn components copy source into `packages/ui`, so the operator still confirms them per the M3 program checklist.

## Data shapes

| Shape                  | Lives in                                                | Holds                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AskChat`              | Prisma model                                            | `{ id, organizationId, ownerId, title, createdAt, updatedAt }`. `title` is the first question, cut to 80 characters at a word. No model call names it. Indexed on `(organizationId, ownerId, updatedAt)`. Deleting the owner or the workspace deletes it.               |
| `Answer`               | Prisma model, reshaped                                  | `{ id, chatId, question, found, body, sources Json, createdAt }`. One row is one turn, a question and its answer. `requesterId` and `organizationId` move to `AskChat`. Indexed on `(chatId, createdAt)`. Deleting the chat deletes its answers.                        |
| `AskInputSchema`       | `packages/contract/src/schemas/ask.ts`                  | `{ chatId?: string, question }`. No `chatId` starts a new chat.                                                                                                                                                                                                         |
| `AnswerSchema`         | same                                                    | Gains `chatId`, so the first `done` event tells the client which chat it started.                                                                                                                                                                                       |
| `AskChatSummarySchema` | same                                                    | `{ id, title, updatedAt }`, one row of the history list.                                                                                                                                                                                                                |
| `AskChatSchema`        | same                                                    | `{ id, title, answers: Answer[] }`, oldest first. Every answer's sources are read again through the asker's access now, as `ask.get` does today.                                                                                                                        |
| `AskEventSchema`       | same                                                    | Unchanged. A `partial` with `{ found, body, sources }`, then `done` with `{ answer }`.                                                                                                                                                                                  |
| `AskHistory`           | `apps/server/src/ask/domain/ask-prompt.ts`              | `{ question, found, body }[]`, the chat's last `ASK_HISTORY_TURNS` (6) turns, capped at `ASK_HISTORY_CHARS_MAX` (8,000). Citations are stripped from the bodies, because their numbers point at an earlier turn's sources.                                              |
| `ASK_CHAT_TURNS_MAX`   | same                                                    | 50. A chat that reaches it refuses another question with `CHAT_FULL`, and the panel offers a new chat. It bounds what `ask.chat` loads.                                                                                                                                 |
| Dock                   | `apps/client/src/components/side-panel.tsx`             | `owners: string[]` in place of `owner`. `claim` pushes, `release` removes, and the last entry shows.                                                                                                                                                                    |
| `AskProvider` state    | `apps/client/src/features/ask/context/ask-provider.tsx` | `{ open, chatId: string \| null, draft }`. Not in the URL, because a citation is a `Link` to another page and would drop a `?ask=` param. `AppShell` outlives client navigation, so the state does too. A reload closes the panel, and the history list finds the chat. |

**Why one row per turn.** Every question gets exactly one answer, stored together once the answer settles. A row per role, as the Vercel chatbot stores it, allows a question with no answer, and nothing here needs that state. `Answer` already holds this pair, so the reshape adds a parent and moves two columns.

**Why a new chat is created with its first answer.** The server picks the chat's id up front and writes the `AskChat` row in the same transaction as the first `Answer`. A first turn that fails leaves no empty chat behind. The client keeps `chatId` null until the first `done` event, so a Retry after a failed first turn starts a new chat again.

## Procedures

| Procedure        | Route                        | Middleware                                                      | Does                                                                    |
| ---------------- | ---------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ask.question`   | `POST /ask`                  | `authorized`, `workspaceMember`, `arcjet.heavyWriteByWorkspace` | Streams one turn. Takes `chatId` to continue a chat.                    |
| `ask.chats`      | `GET /ask/chats`             | `authorized`, `arcjet.read`, `workspaceMember`                  | The asker's 30 newest chats in this workspace, by `updatedAt`.          |
| `ask.chat`       | `GET /ask/chats/{chatId}`    | same                                                            | One chat with its answers. `NOT_FOUND` for anyone but its owner.        |
| `ask.deleteChat` | `DELETE /ask/chats/{chatId}` | `authorized`, `arcjet.write`, `workspaceMember`                 | Deletes the chat and its answers. `NOT_FOUND` for anyone but its owner. |

`ask.get` is deleted, since `ask.chat` returns the same answers. Nothing in the client calls it.

## How a follow-up finds its sources

Retrieval runs on every turn, through the same `SearchService.passages` and the same access check. A follow-up such as "and for Pro?" finds nothing on its own words. So when the chat has earlier turns, the service first asks the model for a standalone search query, through the existing `streamObject` port with the schema `{ query }` and 100 output tokens. "How much does Starter cost?" followed by "and for Pro?" becomes "Pro plan price". If that call fails, the service searches the last question and the new one joined together. A first turn makes no extra call.

The answer prompt then holds the earlier turns in an `<earlier>` tag before the sources. The system prompt says the earlier turns are context and can't be cited, and every claim still cites a numbered source from this turn. The question goes last, as today.

This adds one small model call per follow-up (inferred). Its latency is a guess, about half a second to a second and a half. The retrieval gain can only be measured against a real index, because `eval-ask.ts` hands the model its whole corpus. Appendix C keeps that as a risk until the dev backfill runs.

## Commits

PR #98's branch, `feat/m3-ask`, is reset to `74c9e4c` and the commits below are written on it. That rewrites pushed history, so the force-push waits for the operator.

### Commit 2. Ask chats on the server

**Files.**

- [ ] Edit `schema.prisma`. Add `AskChat`, and reshape `Answer` as above. Replace the folder `21_answers` with `21_ask`. It has not shipped, so `conduit-database` allows the rename.
- [ ] Edit `packages/contract/src/schemas/ask.ts`, `contracts/ask.ts`, and `contract.ts`. Add `CHAT_FULL` to `askErrors`.
- [ ] Edit `apps/server/src/ask/domain/ask-prompt.ts` and its test. Add `AskHistory`, `ASK_REWRITE_PROMPT`, `standaloneQueryInput`, and a `history` argument to `buildAskInput`.
- [ ] Edit `answers.repository.ts` and `prisma-answers.repository.ts`. They gain `createChat` (with its first answer, in one transaction), `addAnswer` (which also moves `updatedAt`), `findChat`, `listChats`, and `deleteChat`. `userNames` stays.
- [ ] Edit `ask.service.ts`, its test, and `ask.controller.ts`.
- [ ] Edit `scripts/eval-ask.ts`. Add three follow-up chains to the fixed corpus.

**Build.**

- [ ] `question(viewer, { chatId, question })` checks AI access first, then loads the chat when `chatId` is set. A chat owned by someone else, or in another workspace, is `NOT_FOUND`, so it never reveals that it exists. A chat at 50 turns is `CHAT_FULL`. Every refusal happens before the stream starts, as today.
- [ ] With history, it builds the search query from the standalone-query call, with the joined-question fallback.
- [ ] `run`, `settled`, and `waitUntil` stay as they are. `store` writes through `createChat` or `addAnswer`.
- [ ] `chat(viewer, chatId)` reads every answer's sources in one `SearchService.readable` call across all turns, then renumbers each body as `get` does now. The per-answer code moves into one private `hydrate`.

**Verify, unit.**

- [ ] `ask-prompt.test.ts` proves that the `<earlier>` block escapes `<`, strips citations, keeps the newest 6 turns, and stops at 8,000 characters.
- [ ] `ask.service.test.ts` proves these points, with the fake `ModelPort` and `fake-search-index.ts`.
  - A follow-up's prompt holds the earlier turns of its own chat, and no other chat's.
  - Another member's `chatId` is `NOT_FOUND` for `question`, `chat`, and `deleteChat`.
  - A first turn that fails stores no chat.
  - `listChats` returns only the asker's chats in this workspace, newest first.
  - Turn 51 is `CHAT_FULL`.
  - The standalone-query call runs only when the chat has history, and its failure falls back.
  - The existing tests still pass. Nothing from an inaccessible room reaches the prompt, a missing citation is dropped, and a reader who stops still gets the answer stored.
- [ ] `eval-ask.ts` asks each chain's follow-up with its earlier turn as history. It fails when the follow-up cites the wrong source or misses the right one. The operator approves the run, and its score goes in the PR body.

### Commit 3. Let the side card stack

**Files.**

- [ ] Edit `apps/client/src/components/side-panel.tsx`.
- [ ] Edit `features/threads/components/thread-layout.tsx`.

**Build.**

- [ ] The dock keeps `owners: string[]`. A `SidePanel` pushes its id on mount and removes it on unmount. The card shows the last one, and closes when the list is empty.
- [ ] `ThreadLayout` keys its `SidePanel` by `threadId ?? splitRoomId`. Opening another thread then mounts a new panel and claims the top. Without the key, a thread opened while Ask is on top would change underneath Ask and stay hidden.

**Verify.**

- [ ] The live check in Commit 4 opens a thread, then Ask, then closes Ask, and the thread shows again. The client has no DOM test setup, and the stack is two one-line updaters, so no unit test was added.
- [ ] Threads and split rooms work as before at xl and below it. This commit changes nothing else, so it is checked on its own.

### Commit 4. The Ask Conduit panel

**Files.**

- [ ] Add `bubble.tsx` and `collapsible.tsx` to `packages/ui/src/components` with the shadcn CLI.
- [ ] Create these in `apps/client/src/features/ask/components/`.
  - `ask-panel.tsx`. `AskPanel` puts the panel in `SidePanel` from xl, and in a right `Sheet` below it.
  - `ask-panel-header.tsx`. The title, the history menu, **New chat**, a menu with **Delete chat**, and **Close**.
  - `ask-transcript.tsx`. `MessageScroller` with every stored turn, then the turn that is streaming.
  - `ask-turn.tsx`. The question in a `Bubble`, then the answer, not-found, stopped, or failed state.
  - `ask-answer.tsx`. `AskAnswer` and its citation pills, moved out of `ask-dialog.tsx` unchanged.
  - `ask-prompt-form.tsx`. The textarea, Send, and Stop.
- [ ] Edit `ask-sources.tsx`. It sits in a `Collapsible` labelled "N sources", open on the newest answer and closed on older ones.
- [ ] Create `apps/client/src/services/ask/queries.ts` with `askChatsQuery` and `askChatQuery`. Rewrite `services/ask/hooks.ts` as `useAskTurn` and `useDeleteAskChat`.
- [ ] Edit `ask-provider.tsx`, `ask-button.tsx`, and `app-shell.tsx`. `AskPanel` renders inside `SidePanelLayout`, loaded with `dynamic` the first time it opens.
- [ ] Delete `ask-dialog.tsx`.
- [ ] Edit `DESIGN.md`, `GLOSSARY.md`, `PRD.md`, and the PR3 section of `m3-files-and-search.md`, which points here.

**Build.**

- [ ] `useAskTurn` keeps the turn that is streaming, `{ question, found, body, sources, status }`, where `status` is `streaming`, `stopped`, or `failed`. On `done` it appends the answer to the `askChatQuery` cache, invalidates `askChatsQuery`, and sets the provider's `chatId`. It is the PR3 hook with one more field.
- [ ] Opening a chat from the history menu, or **New chat**, stops reading the current turn first. The server still stores it.
- [ ] Enter sends, and Shift+Enter adds a line. Composing text in an IME does not send. The field takes `ASK_QUESTION_MAX` (500) characters. Send is disabled while a turn streams.
- [ ] The empty chat is a centred `Empty`. Its title is "Ask Conduit", and its sentence is "Answers from the messages and files you can access. Only you see them."
- [ ] A turn waiting on its first token shows `AILoader` and the shimmer text "Searching what you can access…".
- [ ] A not-found turn says "I couldn't find that in what you can access", with `IconSearchOff`, and has no sources.
- [ ] A failed turn shows its message and **Retry**. Retry sends the same question again.
- [ ] A found answer has **Copy** in its footer.
- [ ] A citation pill is a `Link`. From xl the panel stays open while the main card goes to the source. Below xl the sheet closes first.
- [ ] `MessageScroller` anchors on each new question, as the template does, and the scroll-to-end button appears once the reader scrolls up.
- [ ] One polite live region announces "Answer ready" or "No answer found" when a turn settles, not every token.
- [ ] The panel opens with focus in the field. Escape closes it unless a menu inside it is open, as `ThreadPanel` does.
- [ ] **Delete chat** asks in an `AlertDialog`, then deletes and shows an empty chat.
- [ ] With AI off, the top bar button, the command menu row, and the search page button are gone, as today.
- [ ] Motion follows `emil-design-eng`. The side card opens with no animation, because a member toggles it many times a day. The `Sheet` keeps its own animation, per `DESIGN.md`. New turns appear without an entrance.
- [ ] `DESIGN.md` gains two exceptions. Ask Conduit is a chat and opens in the side card, not a `Dialog`. A chat renders a not-found or failed turn inside the transcript.

**You see.**

- [ ] At 1440 px, a member asks "When does the Q3 launch happen?" and gets an answer citing the decision message. They ask "why was it moved?" and the follow-up answers from the same thread. They click a citation, the channel scrolls to the message, and the panel stays open.
- [ ] They close the panel, open a thread, and open Ask. Ask is on top. Closing Ask shows the thread.
- [ ] The history menu lists the chat by its first question. **New chat** starts an empty one, and picking the old chat brings its turns back.
- [ ] At 390 px, Ask opens as a full-width sheet, and a citation closes it and opens the message.

**Verify.**

- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- [ ] `verify-conduit` runs the four **You see** boxes with screenshots, in both themes, and with the keyboard only.
- [ ] `inspect.mjs --app` passes on the panel, and the PR body has the `emil-design-eng` review table.

## Operator gates

Nothing below runs without a yes.

- [ ] Replace `21_answers` with `21_ask` on the dev DB (`ep-dawn-boat`) and the test DB (`ep-small-flower`). That means dropping the `Answer` table, deleting the `21_answers` row from `_prisma_migrations`, and running `migrate deploy`. The only rows lost are the test answers this session left for Mai Tran.
- [ ] Add `bubble` and `collapsible` to `packages/ui`.
- [ ] Run `eval:ask`, which spends 16 model requests. Each follow-up also runs the rewrite call, to print its query.
- [ ] Force-push `feat/m3-ask` after Commit 4, and rewrite the PR #98 body.

## Appendix A. What a member and a maintainer notice

A member can now ask a follow-up without restating the question, read a cited message while the answer stays beside it, and come back to an earlier chat. Only they see their chats, and an answer still uses only what they can read today.

A maintainer inherits a stacked side card that any later panel can join. Ask's server stays one service with one model port, and one access check guards every turn. The hand-rolled streaming hook stays at about the same size, and the code adds no AI client library.

## Appendix B. Alternatives rejected

- **`useChat` from `@ai-sdk/react`, over an oRPC transport.** oRPC can turn an event iterator into the stream `useChat` reads, but it adds a package for state the PR3 hook already keeps. `useChat` expects the text to grow by appends. Ask's body is rewritten as citations renumber, so it would travel as one replaced data part, and `useChat` would add little. It also suits a client that owns the history, which is the next point.
- **The browser sends the history, as the template's route does.** Saved chats need the history on the server anyway. A history the server reads can't carry text a browser made up and labelled as an earlier answer, and the server caps its size.
- **A row per role, as the Vercel chatbot stores it.** See "Why one row per turn".
- **`?ask=<chatId>` in the URL.** Every citation is a `Link` to another page and would drop it.
- **Keeping the dialog next to the panel.** The operator chose to replace it. Two surfaces would mean two layouts to keep in step.

## Appendix C. Risks

- **Earlier answers in a follow-up's prompt can repeat a fact from a source the asker has since lost.** The stored answer already shows them that text today, so this adds no new exposure (inferred).
- **The standalone query may not help retrieval on real data.** Unmeasured until the dev index is backfilled. If a follow-up check on the dev index shows no gain, delete the call and keep the joined-question search.
- **Stop does not save model spend.** The answer finishes anyway (measured in PR3, where a closed dialog still stored its answer).
- **Chats are kept until their owner deletes them.** A retention limit is a later product call.
- **Rewriting PR #98's history** loses its review comments' anchors, if any exist. Check before the force-push.

## Sources

- [shadcn-ui/chatbot-template](https://github.com/shadcn-ui/chatbot-template). Read its `README.md`, `app/api/chat/route.ts`, `components/chat.tsx`, `chat-message.tsx`, `prompt-form.tsx`, `message-actions.tsx`, `parts/sources-part.tsx`, `ui/message-scroller.tsx`, and `ui/message.tsx` on 2026-11-22.
