# Ask Conduit: attachments and wider context

Today, Ask Conduit reads only message text and file text that search finds. A member can't hand it a screenshot, and it can't say who is in `#launch` or what the member saved last week. This plan adds three things:

- A small composer with file attachments.
- Images read by the answer model, which already reads pictures.
- A wider set of workspace data, always limited to what the asker could open themselves.

It also takes DMs out of Ask Conduit, which removes a behavior that PR3 (#98) ships today.

The work lands as PR4, stacked on `feat/m3-ask`. Nothing in PR1 to PR3 changes, except where Commit 1 below removes DMs.

## Decisions taken

The operator made these calls on 2026-11-22.

| Question                            | Decision                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| What the mini composer keeps        | Plain text, Enter to send, Shift+Enter for a new line, and attachments by button, drag, or paste.     |
| Which attachments Ask Conduit reads | Images (as pictures), PDFs and text files (as text).                                                  |
| What else Ask Conduit reads         | Channels and their members, whole threads, and the asker's own saved items and drafts.                |
| What stays hidden even when visible | Emails and invitations, admin and billing settings, every DM, and auth data (sessions, tokens, keys). |

## Decision: tools

The wider context could reach the model in one of two ways. The user chose **B**, read-only tools, on 2026-11-22.

**A. Retrieval, as today.** The server guesses what is relevant before it calls the model.

- It packs search hits, matching channels and people, and saved items and drafts that match into the prompt.
- It costs one model call per turn.
- Every new kind of data needs its own guess. Saved items and drafts aren't in the search index, so A can only match them by keyword.

**B. Tools.** The model gets read-only tools, and each tool checks the asker's access on every call.

- The tools are `search`, `thread`, `channel`, `people`, `saved`, and `drafts`.
- The AI SDK runs them in one `streamText` call with `stopWhen: isStepCount(ASK_TOOL_STEPS_MAX + 1)`, which is 4.
- The model asks for what the question needs. "Who owns #launch?" calls `channel`. "What did I save about pricing?" calls `saved`.
- It costs 2 to 4 model steps for each turn that uses a tool (a guess, to be measured with `eval:ask`).
- Each new kind of data becomes one more tool.

B changes `ModelPort` (it gains a `tools` request) and the eval script, which must score tool choice. The citation rules stay the same. Every tool result is numbered as a source, and the model cites those numbers.

## Data shape

```ts
// packages/contract
AskInputSchema = { chatId?, question, attachmentIds: string[] } // at most 4
AskAttachmentSchema = { id, name, contentType, size, width?, height?, url } // url is signed and short-lived
AnswerSchema += { attachments: AskAttachment[] }
AnswerSourceSchema += channel | person | draft // saved items are messages
```

```prisma
model AskAttachment {
  id          String   @id
  ownerId     String
  answerId    String?  // null until the question is sent
  key         String   // object storage key, under ask/<ownerId>/
  name        String
  contentType String
  size        Int
  width       Int?
  height      Int?
  createdAt   DateTime @default(now())
}
```

- **An attachment belongs to its asker, not to a room.** `files.uploadUrl` needs a `roomId`, and Ask has no room. So Ask gets its own `ask.attachmentUrl` and `ask.completeAttachment`, which reuse `ObjectStorage` and the same size limits.
- **An unsent attachment is a draft.** It has `answerId` null. A daily sweep deletes drafts older than 24 hours, with their objects. The `search-sync` workflow calls it at `POST /internal/ask-sweep`.
- **Deleting a chat deletes its attachments and their objects.**

## What each data source shows

| Source          | What the model sees                                                    | Hidden                                               |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| Messages, files | Message text and file text in channels the asker can read              | Every DM, and every file sent in one                 |
| Threads         | The root and up to 30 replies, when any message of the thread is a hit | Threads in DMs                                       |
| Channels        | Name, topic, description, visibility, managers, member names           | Channels the asker can't view, and DMs               |
| People          | Name, display name, title, role in the workspace                       | Email, invitations, sessions, everything in settings |
| Saved items     | The asker's own saved messages                                         | Saved messages that sit in a DM                      |
| Drafts          | The asker's own drafts                                                 | Drafts written in a DM                               |
| Attachments     | Images as pictures, and the text of PDFs and text files                | Nothing else is read                                 |

The rule sits in one function, `askScope(viewer)`. It returns the channel ids the asker can read, with DMs removed, and every data source reads through it. A test checks each source against a DM, a private channel the asker isn't in, and a deleted row.

## Model

- **No separate vision model.** A probe in November 2026 showed `AI_SUMMARY_MODEL` reads an attached picture, so images go to the same model and no `AI_VISION_MODEL` exists.
- **The answer is a tool.** With tools, `Output.object` sent a JSON response format on every step, and the model answered at once without calling any tool. The adapter now adds an `answer` tool, requires a tool call each step, and stops when `answer` is called. The tradeoff is that the provider sends the tool input in one or two chunks, so a long answer appears at once instead of word by word.
- **Earlier turns don't resend their images.** The `<earlier>` tag names the files a turn carried, so the model knows they existed, and the follow-up re-reads nothing.
- **Limits.**
  - At most 4 attachments per question.
  - An image goes to the model at up to 5 MB, after resizing its longest side to 1,568 px. The client redraws a larger image as WebP before upload.
  - Attachment text counts toward `ASK_PROMPT_CHARS_MAX`.

## Composer

`AskPromptForm` stays a textarea. The main `Composer` is a Lexical editor whose plugins (formatting, mentions, emoji, embeds) are all things this one drops, so a textarea is the minified composer.

It gains:

- An attach button.
- Drag and drop, and paste.
- `ComposerAttachments`, the chip row the main composer already uses.

`useFileUploads` takes an upload target, so Ask passes `askUploads` and a room passes `roomUploads(roomId)`. Each file uploads as it is added. A sent question shows its attachments above its bubble. An image there opens in the existing `FileViewer`.

## Commits

1. **`feat(ask): keep direct messages out of Ask Conduit`.**
   - Adds `askScope` and uses it in `passages` and in the source re-check.
   - An old answer that cites a DM then drops that source when the chat reloads.
   - Adds tests.
2. **`feat(ask): read channels, people, threads, saved items and drafts`.** The six read-only tools, with the scope tests.

3. **`feat(ask): attach files to a question`.**
   - Adds the migration, the upload procedures, the sweep, the answer tool, and image parts in `ModelPort`.
   - Production needs `pnpm db:migrate-deploy` first.
4. **`feat(ask): attach files from the Ask composer`.** Adds the attach button, drag and paste, chips, and attachments in the transcript.
5. **`test(ask): eval attachments and the new sources`.** Extends `eval:ask` with an image question, a channel question, a saved-item question, and a DM question that must find nothing.

All five commits are written and tested, not yet committed.

## Checks

- `eval:ask` passes every case, including the new ones.
- The scope tests prove that no DM text, email, or invitation reaches a prompt.
- A live journey as Mai Tran:
  - Attach a screenshot and ask about it.
  - Ask who is in `#launch`.
  - Ask about a saved message.
  - Ask about a DM and get not-found.
  - Reload, and see the attachment still on its turn.
