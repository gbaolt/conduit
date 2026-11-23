# Attach menu, snippets, and the Conduit guide

M3 shipped uploads and Ask Conduit. This plan improves both for members.

- The paperclip in every composer opens a menu with **Files**, **Snippet**, and **Upload from your device**. Files picks a file already shared in the workspace. Snippet writes a text or code file in place.
- A sent snippet shows as highlighted code in the message, not a bare file card.
- Ask Conduit reads a built-in **Conduit guide**, so "What is Conduit?" and "How do I search a channel?" get cited answers.

The rule this plan enforces is that attaching an existing file never lets anyone open a file they couldn't open before.

The work lands as four PRs against `staging`, in this order: PR1 (guide), PR2 (menu and snippet dialog), PR3 (snippet preview), PR4 (Files dialog). PR1, PR2, and PR3 are independent. PR4 needs PR2 and PR3.

## Decisions taken

The operator made these calls on 2026-11-22.

| Question                              | Decision                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What the knowledge base covers        | A Conduit guide about the app itself. Ask cites each article like any other source.                                                                                      |
| Where the attach menu appears         | The room composer in channels, DMs, and threads, and the Ask composer.                                                                                                   |
| How a sent snippet shows              | A code preview with the first lines highlighted. A click opens the whole snippet.                                                                                        |
| Which files can be attached to a room | A file from a public channel, or a file already in the target room. A file from a private channel or a DM shows disabled in the Files dialog, and the server refuses it. |
| The workspace storage cap             | 10 GB, fixed. It is no longer a placeholder.                                                                                                                             |
| Where the guide lives                 | In the repo, as typed modules that PR1 adds. No database table.                                                                                                          |

One call is the plan's default, which the operator can overturn. **Ask may attach a file from a private channel the asker belongs to.** An Ask attachment is seen by the asker alone, and Ask checks the asker's access on every read, so nobody gains access. DM files stay out of Ask, as they are today.

## Decision: where the guide lives

The operator chose **A, the repo**, on 2026-11-22. The guide ships in PR1, in the same PR as the tool that reads it. The weighing stays here for the next reader.

**A. In the repo, as typed modules under `apps/server/src/ask/domain/guide/`.**

- The guide describes the app, and the app ships from the repo. An article changes in the same PR as the feature it describes, so the two can't drift apart on a deploy.
- A reviewer reads the article diff next to the code diff.
- No table, no migration, no admin editor, and no seed step per environment.
- Each article is a `.ts` file. Markdown files would need a copy step in the Nest SWC build and in the Vercel deploy. A typed module needs none, the compiler rejects a missing field, and an article can import the contract's constants for every number it states.
- The cost is that only a deploy changes the guide.

**B. In Postgres, as a `GuideArticle` table.**

- Someone could edit the guide without a deploy, through an admin screen that doesn't exist yet.
- It needs a migration, a seed for every environment, and an editor, before it answers a single question.
- A row can describe a feature the running build doesn't have, or miss one it does.

B wins only if non-engineers must edit the guide between deploys, or if each workspace needs its own articles. Neither is true today. A workspace's own documents are M4 Canvas, and Ask can read canvases once they exist.

**How Ask finds an article.** The guide holds about 15 articles. The system prompt lists each slug and title, and the model reads an article with a `guide` tool by slug. That needs no search index. If the guide grows past about 50 articles, index it in Upstash under a shared `guide` namespace and make the tool search it.

## Data shape

```ts
// packages/contract/src/lib/file-kind.ts
FileKind = 'image' | 'video' | 'pdf' | 'text' | 'other'
// text is text/* plus application/json, xml, and csv. other is everything else.

// packages/contract/src/lib/file-share.ts, run by the dialog and by the server
canAttachToRoom(source: { room: { id, kind, visibility } }, targetRoomId: string): boolean
// true when the source room is a public channel, or is the target room

// packages/contract/src/schemas/files.ts
ListedFileSchema.room += { visibility: 'public' | 'private' } // a DM is private
ListFilesInputSchema = {
  roomId?, uploaderId?, name?, before?, limit?,
  kinds?: FileKind[],                 // replaces `kind`. The Files page passes one.
  owner?: 'me' | 'others',            // "Created by you" and "Shared with you"
  roomKind?: 'channel',               // Ask leaves out DMs
}
FileCountsSchema = Record<FileKind, number>           // files.counts, same filters minus kinds
FileAttachInputSchema = { fileId, roomId }            // files.attach, returns MessageFile
FileTextSchema = { text: string, truncated: boolean }  // files.text, at most FILE_TEXT_PREVIEW_MAX
filesErrors += FILE_NOT_SHAREABLE                     // "Files from private channels and DMs stay where they were shared."

// packages/contract/src/schemas/ask.ts
AnswerSourceSchema += { type: 'guide', article: { slug, title } }
AskGuideArticleSchema = { slug, title, body }         // ask.guide({ slug })
AskAttachmentSchema += { available: boolean }         // false once the asker can't open the file
// ask.attachFile({ fileId }) returns the same shape as a completed Ask upload.
```

```ts
// apps/server/src/ask/domain/guide/guide.ts
type GuideArticle = {
  slug: string;
  title: string;
  /** The PRD rows the article describes, such as 'M3.5'. A test holds them to the PRD's Shipped rows. */
  covers: readonly string[];
  body: string;
};
export const GUIDE: readonly GuideArticle[]

// apps/server/src/storage/domain/object-storage.ts
abstract copy(fromKey: string, toKey: string): Promise<void>     // S3 CopyObject, inside storage
abstract readRange(key: string, bytes: number): Promise<Uint8Array> // S3 ranged GET

// apps/client/src/services/files/upload.ts
UploadTarget += { attach?: (file: ListedFile) => Promise<{ id: string }> }
useFileUploads(...) += { attach(files: ListedFile[]) }
```

```ts
// apps/client/src/components/attach/
<AttachMenu uploads={uploads} files={{ kinds?, roomKind?, targetRoomId? }} max={remaining} />
```

```prisma
model File {
  // The original file a copy came from, or null for an upload. A copy of a copy points at the original.
  sourceFileId String?
}

model AskAttachment {
  // Set when the asker picked the file from Files. The attachment then reads the file instead of a copy.
  fileId String?
  key    String? @unique // null when fileId is set
}
```

**One database migration, in PR4.** It adds `File.sourceFileId` and `AskAttachment.fileId`, and makes `AskAttachment.key` nullable. `Answer.sources` is already `Json`, so a `{ type: 'guide', id: slug }` ref needs no change.

**Attaching a file to a room copies it.** `files.attach` copies the object to a new key and creates a new `File` row in the target room, with `sourceFileId` set. `File.key` is unique, so two rows can't share one object. Deleting the original message never removes the copy. The copy counts toward the 10 GB cap.

## Load before coding

Every PR loads these, per `AGENTS.md`.

- `conduit-structure`, `conduit-components`, and `mattpocock-skills:codebase-design`, since each PR adds files.
- `orpc-contract` for the contract changes, and `nestjs-best-practices` for `apps/server`.
- `conduit-database` for PR4's migration.
- `vercel-react-best-practices` and `vercel-composition-patterns` for the components, and `DESIGN.md`.
- `next-dev-loop` and `verify-conduit` before reporting any client change as done.

## PR1. Add the Conduit guide to Ask Conduit

**Depends on.** None.

**Files.**

- [ ] Create `apps/server/src/ask/domain/guide/` with `guide.ts` (the type and the `GUIDE` registry), one module per article, and `guide.test.ts`.
- [ ] Edit `apps/server/src/ask/domain/ask-prompt.ts`.
- [ ] Edit `apps/server/src/ask/application/ask.service.ts`.
- [ ] Edit `apps/server/src/ask/presentation/ask.controller.ts`.
- [ ] Edit `packages/contract/src/schemas/ask.ts` and `packages/contract/src/contracts/ask.ts`.
- [ ] Edit `apps/client/src/features/ask/components/ask-sources.tsx` and `apps/client/src/features/ask/lib/source-href.ts`.
- [ ] Create `apps/client/src/features/ask/components/ask-guide-panel.tsx`.
- [ ] Edit `apps/client/src/services/ask/queries.ts`.
- [ ] Edit `apps/server/scripts/eval-ask.ts` and its fixtures.
- [ ] Edit `PRD.md`.

**Build.**

- [ ] Write the articles from the shipped rows of `PRD.md`, and only those. The first draft covers these topics.
  - [ ] What Conduit is and who it is for.
  - [ ] Workspaces, members, roles, and invitations.
  - [ ] Channels, sections, and starring. DMs. Threads.
  - [ ] Writing messages, formatting, mentions, and editing.
  - [ ] Files, uploads, and the file and workspace limits. Snippets, once PR2 lands.
  - [ ] Search, its filters, and the `Ctrl+K` command menu.
  - [ ] Activity, notifications, Smart Activity, and Catch me up.
  - [ ] Summaries, and Ask Conduit itself, with what it can and can't see.
  - [ ] AI privacy, from the PRD's AI rules, and how an admin turns AI off.
- [ ] Build every number in an article from the contract's constants, such as `formatFileSize(FILE_SIZE_MAX)` and `formatFileSize(WORKSPACE_STORAGE_MAX)`, never a typed literal.
- [ ] Describe each admin setting as a default the workspace may change, such as "By default any member can create a channel. An admin can limit that." Ask can't read workspace settings (decided in `m3-ask-context.md`), so the article tells the member to ask an admin.
- [ ] Give each article its `covers` list of PRD row ids. Keep a `NOT_IN_GUIDE` list in `guide.ts` for shipped rows a member never sees, such as F.5 (Arcjet).
- [ ] Add a `guide` tool in `AskService.tools`. It takes `slugs: string[]` (at most 3), returns each article as a numbered `<source type="guide">`, and joins `input.sources` the way the other tools do. `passageKey` is `guide:<slug>`.
- [ ] Add the guide's catalog to `ASK_SYSTEM_PROMPT`, one line per article with its slug and title. Widen the first line to "what the team wrote in chat, shared in files, and the Conduit guide about the app itself".
- [ ] Add the prompt rules for both kinds of source. Read the guide for questions about how the app works. When the workspace sources use a word, such as "Conduit", for something of the team's own, answer from them. When both apply, answer both, each cited.
- [ ] Map a stored `{ type: 'guide', id }` ref back to its article on reload. A slug that no longer exists drops out, as a deleted message does.
- [ ] Add `ask.guide({ slug })`, behind `authorized`, `arcjet.read`, `workspaceMember`, and the AI switch. It returns the article for the panel.
- [ ] Render a guide source as a chip with the book icon and the article title. A click opens `AskGuidePanel` in the side card stack, the way a cited message opens its thread. The panel renders the body with the same Markdown renderer messages use.
- [ ] In `PRD.md`, remove "The 10 GB storage cap for each workspace is a placeholder" from the open questions.
- [ ] Add eval cases.
  - [ ] "What is Conduit?", "How do I filter search by person?", "Can Ask Conduit read my DMs?", "How big can a file be?", and "What does Catch me up do?" must cite a guide article.
  - [ ] Two workspace questions from the existing fixtures must cite workspace sources and no guide article.
  - [ ] A fixture channel discusses "the Conduit pipeline" as a team project. "What's the status of Conduit?" must cite those messages.

**You see.**

- [ ] "What is Conduit?" streams a short answer that cites `[1]`, and source 1 is the chip "What Conduit is". The screenshot from the operator's report no longer shows the not-found line.
- [ ] Clicking the chip opens the article in the side card. Closing it returns to the chat.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `guide.test.ts` holds the guide to the PRD.
  - [ ] Every slug is unique, kebab case, and listed in the prompt's catalog.
  - [ ] No article body holds a typed size, such as `50 MB` or `10 GB`.
  - [ ] Every id in `covers` is a row of `PRD.md` with the status Shipped.
  - [ ] Every Shipped row is covered by an article or listed in `NOT_IN_GUIDE`.
- [ ] `ask.service.test.ts` gains a case where the fake model calls `guide`, cites it, and the stored answer reloads with the guide source. Another case reloads a ref whose slug was removed. Run `pnpm --filter server test`.
- [ ] Run `pnpm --filter server eval:ask`. Pass when every guide case cites a guide article, both workspace cases cite no guide article, and the pipeline case cites the pipeline messages.

**Verify, live.** Through `verify-conduit`, signed in as a `delivered+guide@resend.dev` test account.

- [ ] Ask "What is Conduit?" in a fresh chat. Save `guide-what-is-conduit.png`. Pass when the answer is found and cites a guide chip.
- [ ] Open the chip. Save `guide-panel.png`. Pass when the article shows in the side card and Close returns to the chat.
- [ ] Reload the page and reopen the chat from history. Save `guide-reloaded.png`. Pass when the guide chip is still there.
- [ ] Ask a workspace question the seed answers. Save `guide-workspace-question.png`. Pass when it cites a message and no guide chip.
- [ ] Turn AI off as an admin and ask again. Pass when Ask refuses as it does today.
- [ ] Repeat the first lane at 360 px wide, in dark theme. Save `guide-phone-dark.png`.

**Verify, perf.**

- [ ] Metric. Time to the first streamed token and model steps per turn, from `eval:ask`.
- [ ] Baseline. Run `eval:ask` on `staging` first and record both numbers.
- [ ] Rule. Workspace questions stay within 10% of the baseline time to first token. A guide question uses at most 2 steps.
- [ ] Run the guide cases once with a one-line summary beside each title in the catalog. Keep the summaries only if they make a guide case pass that fails without them.

**Review gate.** The operator reads the article drafts in the PR diff and reviews the screenshots before merge.

## PR2. Open an attach menu from the paperclip, with a snippet dialog

**Depends on.** None.

**Files.**

- [ ] Create `apps/client/src/components/attach/attach-menu.tsx`, `snippet-dialog.tsx`, and `snippet-name.ts` with its test.
- [ ] Edit `apps/client/src/components/composer/composer-toolbar.tsx` and `composer.tsx`.
- [ ] Edit `apps/client/src/features/messages/components/conversation/conversation-composer.tsx`.
- [ ] Edit `apps/client/src/features/ask/components/ask-prompt-form.tsx`.

**Build.**

- [ ] Replace the paperclip `ToolbarButton` and its hidden input in `ComposerActionBar` with an `attach` slot. `Composer` keeps `onFiles` for paste and drop. `ConversationComposer` and `AskPromptForm` each pass `<AttachMenu>`.
- [ ] Build `AttachMenu` from `DropdownMenu` in `packages/ui`. Its trigger is the paperclip with the tooltip "Attach". Its items are **Files** (disabled until PR4), **Snippet**, and **Upload from your device**, each with an icon. The trigger keeps `onMouseDown` from taking focus, so the editor keeps its selection. The device item clicks the hidden `<input type="file" multiple>` and passes the picked files to `uploads.add`, as today.
- [ ] Build `SnippetDialog` from `Dialog`, `Field`, `Input`, `Combobox`, `Textarea`, and `Checkbox`.
  - [ ] Title is optional, with the placeholder `snippet.txt`.
  - [ ] Type is a searchable combobox. It lists **Auto detect** first, then **Plain text**, then Shiki's languages, which `CodeBlockContent` already highlights. The list loads with Shiki when the dialog opens. Auto detect reads the title's extension and falls back to plain text. Content-based detection is left out.
  - [ ] Content is a monospace `Textarea` with a line-number gutter that scrolls with it. **Wrap** turns on soft wrapping and hides the gutter, because wrapped lines would misnumber it.
  - [ ] The reference's message box and "Share this file" select are left out. The snippet joins the composer, and the member writes the message there.
  - [ ] **Create snippet** builds `new File([content], name, { type: 'text/plain' })` and passes it to `uploads.add`.
  - [ ] Create stays disabled while Content is empty. Content above `FILE_SIZE_MAX` shows the existing size error.
- [ ] Build `snippetName(title, type)` in `snippet-name.ts`. The extension always matches the type, so a snippet never poses as another kind of file.
  - [ ] No title gives `snippet.<ext>`.
  - [ ] A title without an extension gets the type's.
  - [ ] A title whose extension doesn't match the type keeps it and gains the type's, so `invoice.pdf` as Plain text becomes `invoice.pdf.txt`.
- [ ] In Ask, the menu passes the remaining slots of `ASK_ATTACHMENTS_MAX`, and Snippet and Upload disable when none are left.

**Motion.** The menu keeps `packages/ui`'s open and close animation (100 ms, scale 0.95 to 1 from `--transform-origin`), per `DESIGN.md`. The dialog keeps its centered zoom. Nothing else in the menu or dialog animates.

**You see.**

- [ ] The paperclip opens the menu above the composer. Picking Snippet opens the dialog, and Create adds a `snippet.ts` chip to the composer, which sends like any file.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `snippet-name.test.ts` covers no title, a title without an extension, a matching extension, a mismatched one, and Auto detect. Run `pnpm --filter client test`.

**Verify, live.** Through `verify-conduit`.

- [ ] Open the menu from a channel composer with the mouse, and again from the keyboard. Save `attach-menu.png`. Pass when focus lands on the first item and Escape returns it to the paperclip.
- [ ] Upload from your device sends an image. Pass when the message shows it, as on `staging`.
- [ ] Create a TypeScript snippet and send it. Save `snippet-dialog.png` and `snippet-sent.png`. Pass when the message carries `snippet.ts`.
- [ ] Toggle Wrap with a long line. Save `snippet-wrap.png`. Pass when the line wraps and no gutter number sits beside a wrapped row.
- [ ] Attach a snippet in Ask and ask about it. Pass when the answer names the snippet.
- [ ] In Ask with 4 files attached, open the menu. Pass when Snippet and Upload are disabled.
- [ ] Repeat the menu and the dialog at 360 px, in dark theme. Save `attach-phone-dark.png`.

**Verify, perf.** None. PR2 adds no request and no work on a hot path.

**Review gate.** The operator reviews the menu and dialog screenshots and a short recording before merge.

## PR3. Show a sent snippet as highlighted code

**Depends on.** None. It covers every text file, whether a snippet or an upload.

**Files.**

- [ ] Edit `packages/contract/src/lib/file-kind.ts` and `file-kind.test.ts`.
- [ ] Edit `packages/contract/src/schemas/files.ts` and `contracts/files.ts`.
- [ ] Edit `apps/server/src/storage/domain/object-storage.ts`, `infrastructure/s3-object-storage.ts`, and `testing/fake-object-storage.ts`.
- [ ] Edit `apps/server/src/files/application/files.service.ts`, `presentation/files.controller.ts`, and `infrastructure/prisma-files.repository.ts`.
- [ ] Edit `apps/client/src/features/messages/components/message/message-files.tsx`.
- [ ] Create `apps/client/src/features/messages/components/message/message-snippet.tsx`.
- [ ] Edit `apps/client/src/components/file-viewer.tsx` and `file-kind-icon.tsx`.
- [ ] Edit `apps/client/src/features/files/components/files-toolbar.tsx`.

**Build.**

- [ ] Add `text` to `FileKind`. `fileKind` maps `text/*` and `application/json`, `xml`, and `csv` to it. The repository's kind filter matches `text/%` by prefix and leaves those types out of `other`. Fix every place the type checker flags, such as `KIND_LABELS`.
- [ ] Add `ObjectStorage.readRange`, an S3 `GetObject` with a `Range` header, and the fake's version.
- [ ] Add `files.text({ fileId })`. It checks the file's room is readable, as `urls` does, and reads only the first 64 KB. It decodes the bytes as UTF-8 and drops a character the cut split in half. It returns at most `FILE_TEXT_PREVIEW_MAX` (64 KB) with `truncated`. A NUL byte in the first 8 KB means the file isn't text, and the call returns `NOT_TEXT`, so the message falls back to its file card.
- [ ] Build `MessageSnippet` from `CodeBlock`, `CodeBlockHeader`, `CodeBlockCopyButton`, and `CodeBlockContent` in `components/code-block.tsx`. Messages' code fences already use it. It shows the file name and language, then the first 8 lines, and each line is cut at 200 characters. It fetches the text only once the row scrolls into view. Clicking it opens the viewer.
- [ ] The viewer shows the whole text with the same parts, plus Wrap and Download. A truncated file says "Showing the first 64 KB" next to Download.
- [ ] The language comes from the file's extension. An extension Shiki doesn't know shows as plain text.
- [ ] The Files page's Type filter gains "Text and code".

**You see.**

- [ ] A sent `snippet.ts` shows 8 highlighted lines in the message. The viewer shows all of it.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `file-kind.test.ts` gains `text` cases, and `other` no longer matches `text/plain`. Run `pnpm --filter contract test`.
- [ ] `files.service.test.ts` gains `text` cases. Run `pnpm --filter server test`.
  - [ ] A readable room returns the text. An unreadable room returns `NOT_FOUND`.
  - [ ] A 100 KB file comes back truncated, and the fake storage records a 64 KB range read, not a whole read.
  - [ ] A cut through a multi-byte character drops that character instead of showing a replacement mark.
  - [ ] A `text/plain` file holding NUL bytes returns `NOT_TEXT`.
- [ ] A client test renders `MessageSnippet` with `<script>alert(1)</script>` as its text. Pass when the text shows as written and no script element exists.

**Verify, live.** Through `verify-conduit`.

- [ ] A snippet sent on PR2's flow renders as code. Save `snippet-preview.png`.
- [ ] Open the viewer. Save `snippet-viewer.png`. Pass when every line shows and Copy copies it.
- [ ] Upload a 30 MB `.log` file. Save `snippet-big.png`. Pass when the preview shows its first lines and the viewer shows the 64 KB note.
- [ ] Upload a binary renamed to `.txt`. Pass when the message shows a file card.
- [ ] A member outside a private channel opens the snippet's file id. Pass when `files.text` returns `NOT_FOUND`.
- [ ] Filter the Files page by "Text and code". Pass when only text files list.
- [ ] Repeat the preview at 360 px, in dark theme. Save `snippet-phone-dark.png`.

**Verify, perf.**

- [ ] Metric. Requests and render time when a channel with 20 snippets opens, and the main thread's longest task when the viewer opens a 64 KB file.
- [ ] Baseline. The same channel on `staging`, where each snippet is a file card.
- [ ] Rule. Only snippets in view fetch text. Opening the channel must not add more than 200 ms to the log's first paint. If highlighting 64 KB blocks the main thread for more than 200 ms, the viewer highlights the first 2,000 lines and shows the rest as plain text.

**Review gate.** The operator reviews the preview and viewer screenshots before merge.

## PR4. Pick an existing file from a Files dialog

**Depends on.** PR2 for the menu and PR3 for the `text` kind and `readRange`.

**Files.**

- [ ] Create `packages/contract/src/lib/file-share.ts` and `file-share.test.ts`.
- [ ] Edit `packages/contract/src/schemas/files.ts`, `contracts/files.ts`, `schemas/ask.ts`, and `contracts/ask.ts`.
- [ ] Edit `apps/server/database/schema.prisma` and add the migration.
- [ ] Edit `apps/server/src/storage/domain/object-storage.ts`, `infrastructure/s3-object-storage.ts`, and `testing/fake-object-storage.ts`.
- [ ] Edit `apps/server/src/files/` (service, controller, repository).
- [ ] Edit `apps/server/src/ask/application/ask-attachments.service.ts`, its repository, and `presentation/ask.controller.ts`.
- [ ] Edit `apps/client/src/services/files/upload.ts` and `queries.ts`.
- [ ] Create `apps/client/src/components/attach/files-dialog.tsx`.
- [ ] Edit `apps/client/src/features/files/` callers of `kind`.
- [ ] Edit `apps/client/src/features/ask/components/ask-question-attachments.tsx`.

**Build.**

- [ ] Add `canAttachToRoom` in `packages/contract/src/lib/file-share.ts`. The dialog and the server both run it, so the two can't disagree.
- [ ] Add `visibility` to `ListedFile.room`.
- [ ] Replace `kind` with `kinds` in `ListFilesInput`, and move the Files page to it in the same commit. Add `owner` and `roomKind`.
- [ ] Add `files.counts`, one `groupBy` over the same readable rooms and filters.
- [ ] Add the migration for `File.sourceFileId`, `AskAttachment.fileId`, and the nullable `AskAttachment.key`, per `conduit-database`.
- [ ] Add `ObjectStorage.copy` with `CopyObjectCommand`, and the fake's copy.
- [ ] Add `files.attach({ fileId, roomId })` behind `arcjet.heavyWrite`, since each call copies up to 50 MB.
  - [ ] The source file must be sent, not deleted, and in a room the viewer can read. Otherwise it returns `NOT_FOUND`.
  - [ ] `canAttachToRoom` must pass. Otherwise it returns `FILE_NOT_SHAREABLE`. The server reads the source room's visibility at this moment, so a channel made private after the dialog opened is refused.
  - [ ] The target room is checked as `uploadUrl` checks it.
  - [ ] It creates a pending row under the 10 GB cap, copies the object, and marks the row ready with the source's size and dimensions. `sourceFileId` is the source's own `sourceFileId`, or the source's id when it has none.
  - [ ] A failed copy leaves a pending row, which the sweep removes after `PENDING_TTL_MS`, as for an abandoned upload.
- [ ] Add `ask.attachFile({ fileId })`.
  - [ ] The file must sit in a channel the asker can read, public or private, and never in a DM. Otherwise it returns `NOT_FOUND`.
  - [ ] It runs `askAttachmentProblem`, and creates a ready `AskAttachment` with `fileId` set and no copy.
  - [ ] Every later read, by the model or by the chip's link, checks the channel again. When the asker has lost access or the file is gone, the attachment reads as `available: false`, its chip says "No longer available", and the model doesn't read it.
- [ ] Add `attach` to `UploadTarget` and `useFileUploads`. An attached file shows as a chip that turns ready when the call returns. A refused or failed attach turns the chip into an error, with the server's message, as a failed upload does. That covers `STORAGE_FULL`. Remove cancels it as for an upload.
- [ ] Build `FilesDialog` from `Dialog`, `InputGroup`, `ToggleGroup`, and `ScrollArea`, after the operator's reference.
  - [ ] A search field across the top filters by name.
  - [ ] The left rail lists All files, Images, Videos, PDFs, Text and code, and Other, each with its count. On a phone it becomes a `Select` above the list.
  - [ ] A toggle group sets All, Shared with you, or Created by you.
  - [ ] Each row shows a thumbnail or `FileKindIcon`, the name, the size, and "uploader · where it was shared · relative date". A private channel shows a lock, and a DM shows the person's name. Rows keep one fixed height, per `DESIGN.md`.
  - [ ] A row that fails `canAttachToRoom` is disabled. It keeps its place, dims, can't be selected, and carries `aria-disabled`. Its tooltip says "Files from private channels and DMs stay where they were shared."
  - [ ] The list loads more on scroll through `before`. It loads behind `Skeleton` rows sized to the loaded rows.
  - [ ] A member selects several files, up to the remaining slots. **Insert** attaches them, and shows a pending state until every call returns, so a second click can't copy twice. **Upload** opens the device picker instead.
  - [ ] The "Recently viewed" sort from the reference is left out, because Conduit doesn't record views. The list is newest first.
  - [ ] In Ask, the dialog passes `kinds: ['image', 'pdf', 'text']` and `roomKind: 'channel'`, hides the rails for other kinds, and disables no private-channel row.

**You see.**

- [ ] In `#general`, Files opens the dialog. Picking a PDF from `#design` and Insert adds its chip, and the sent message shows the PDF preview.
- [ ] A file from 🔒 #leadership shows dimmed with the tooltip, and clicking it does nothing.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `file-share.test.ts` covers a public channel to another room, a private channel to another room, a private channel to itself, a DM to a channel, and a DM to itself. Run `pnpm --filter contract test`.
- [ ] `files.service.test.ts` gains `attach` cases. Run `pnpm --filter server test`.
  - [ ] A public channel's file copies into the target room, with `sourceFileId` set to the original.
  - [ ] A copy of a copy points at the original.
  - [ ] A private channel's file returns `FILE_NOT_SHAREABLE`, even for a member of that channel. So does a DM's file.
  - [ ] A private channel's file attached back into that same channel copies.
  - [ ] A file in a room the viewer can't read returns `NOT_FOUND`. An archived target returns `CHANNEL_ARCHIVED`. A full workspace returns `STORAGE_FULL`.
  - [ ] `owner`, `kinds`, and `roomKind` each narrow `list` and `counts`.
- [ ] `ask.service.test.ts` gains `attachFile` cases.
  - [ ] A private channel's file the asker belongs to attaches, with no new storage object.
  - [ ] A DM file returns `NOT_FOUND`, and a video returns `ATTACHMENT_REJECTED`.
  - [ ] After the asker leaves the channel, reloading the chat shows the attachment as unavailable, and a follow-up question doesn't read it.
- [ ] `s3-object-storage.test.ts` gains a `copy` case.

**Verify, live.** Through `verify-conduit`, with seed files in a public channel, a private channel, and a DM.

- [ ] Open Files from a channel composer. Save `files-dialog.png`. Pass when the counts match the Files page for each kind.
- [ ] Search "spec", pick two files from a public channel, Insert, and send. Save `files-inserted.png`. Pass when the message carries both files and their previews.
- [ ] Hover a private channel's file and a DM's file. Save `files-disabled.png`. Pass when both are dimmed, show the tooltip, and can't be selected.
- [ ] Call `files.attach` directly with a private channel's file id. Pass when it returns `FILE_NOT_SHAREABLE` and no row or object is created.
- [ ] Delete the original message. Pass when the new message's files still open.
- [ ] Open Files from Ask. Save `files-dialog-ask.png`. Pass when private channel files are selectable, no DM file and no video lists, and an inserted PDF answers a question.
- [ ] Remove the asker from that private channel and reopen the chat. Save `files-ask-unavailable.png`. Pass when the chip says "No longer available".
- [ ] Keyboard only. Tab to search, arrow through rows, Space selects, and Enter inserts. A disabled row is announced as unavailable, with its reason. Save `files-keyboard.png`.
- [ ] Repeat at 360 px, in dark theme. Save `files-phone-dark.png`.

**Verify, perf.**

- [ ] Metric. Time from the menu click to the first rows, and `files.attach` time for a 40 MB file.
- [ ] Baseline. `files.list` time on the Files page on `staging`, same seed.
- [ ] Rule. First rows within 300 ms of the `staging` Files page time. `files.attach` for 40 MB under 3 s, since the copy runs inside storage.

**Review gate.** The operator reviews the dialog screenshots and a short recording before merge.

## Close the work

- [ ] Every box above is checked with its evidence.
- [ ] Mark the new rows in `PRD.md` under M3 as shipped, with their PR links. Update the guide's `covers` lists in the same commit, since `guide.test.ts` fails until they match.
- [ ] Reply with the PR links, the checks run, the checks skipped, and the test data left behind.

## Appendix A. Open questions

- The plan's default that Ask may attach private-channel files stands unless the operator says otherwise.
- No prototype ran for this plan. Two answers rest on reading the code, not on a run. Each PR checks its own in its first commit.
  - [ ] PR4. CopyObject works on the R2 bucket (guess, from R2's S3 compatibility).
  - [ ] PR2. Shiki's language list holds the short names the snippet extensions need, such as `ts` and `py` (guess).

## Appendix B. Alternatives rejected

- **Inline the whole guide in every prompt.** About 15 articles of a few hundred words each would add 30,000 or more characters to every turn, most of them unused. The catalog plus a tool reads an article only when the question needs it.
- **Search the guide through the Upstash index.** At 15 articles, a slug list the model reads is exact, and a search can miss. It becomes worth it past about 50 articles.
- **Answer from the model's own knowledge.** The operator chose the guide, which keeps the PRD rule that every answer links to what it used.
- **Hide unshareable files from the dialog.** The operator chose to show them disabled, so a member sees the file exists and learns why it can't move.
- **Confirm before sharing a private file.** The first draft asked "Everyone in #general will be able to open it." A confirmation still lets the file out. The operator forbade it instead.
- **Allow a private file into a room whose members all belong to the source.** It would be safe, but membership changes after the copy, and the rule would need a member-set comparison on every attach. The plan allows only the same room, which stays safe forever.
- **Share one stored object between rooms, with a reference count.** Copies would cost no storage, but `File.key` is unique, the cap query sums `File.size`, and the sweep deletes one key per row. All three would change. `sourceFileId` keeps the path open if copies ever fill workspaces.
- **Fetch snippet text in the browser from the signed URL.** It needs the bucket's CORS to allow GET from the app's origin, and it skips the server's access check on each read. `files.text` needs neither.
- **Reuse `FileText` for snippet text.** It reads the whole object and gives up above 20 MB, so a 30 MB log would show nothing.
- **Prism through `@lexical/code-prism` for snippets.** `CodeBlock` already highlights message code with Shiki and renders tokens as text, so snippets match code fences.
- **A Lexical code editor in the snippet dialog.** It would highlight as the member types, but it pulls the editor stack into a dialog for a plain text field. Highlighting shows once the snippet is sent.

## Appendix C. Risks and their fixes

Each risk names what goes wrong, the fix the plan builds, and what is left.

**1. A private file leaks into another room (PR4).**

- What goes wrong. Linh opens Files in #general and inserts `reorg-plan.pdf` from 🔒 #leadership by mistake. Conduit has no forwarding, so today that takes a download and a re-upload.
- The fix. `canAttachToRoom` allows only a public channel's file, or a file already in the target room. A public channel is readable by every member, as `accessibleRoomIds` shows, so a copy gives nobody new access. The dialog disables every other row, and `files.attach` refuses it with `FILE_NOT_SHAREABLE`. Both run the same function from the contract.
- A race. A channel made private after the dialog opened is refused, because the server reads visibility at attach time.
- What is left. A copy made while a channel was public stays when the channel later turns private. The file was open to every member when it moved. A member can still download a file and upload it elsewhere. No app can stop that.

**2. Copies outlive a takedown (PR4).**

- What goes wrong. A salary sheet is posted in public #general by mistake and inserted into #finance before an admin deletes the original. The copy in #finance stays.
- The fix. Every copy records `sourceFileId`, pointing at the original. A later "Delete every copy" action for admins needs only that column. The data must exist from the first copy, because copies made without it can never be linked.
- What is left. The "Delete every copy" button is not in this plan. Until it ships, the admin finds copies by name on the Files page. Only public files can be copied, so a copy never reaches anyone the original hadn't.

**3. Ask keeps a file after its asker loses access (PR4).**

- What goes wrong. A contractor attaches `acme-contract.pdf` from 🔒 #client-acme, then is removed from the channel.
- The fix. The Ask attachment points at the file instead of copying it, and every read checks access again. The chip turns "No longer available", and follow-ups stop reading it.
- What is left. An answer already written keeps its text, as an answer that cited a message does today (inferred from `Answer.body` being stored text).

**4. Copies fill the fixed 10 GB (PR4).**

- What goes wrong. A 40 MB deck inserted into 5 channels uses 200 MB.
- The fix. Each copy counts, because the bytes are real. The dialog shows each file's size. A copy that would pass the cap fails in its chip with the same message an upload gets, before any bytes are copied. Ask attachments point at the original and cost nothing. Only public files can be copied, which narrows how often it happens.
- What is left. Copies still use space. If that becomes a problem, shared objects with a reference count (Appendix B) make copies free, and `sourceFileId` already links each copy to its original.

**5. The guide answers wrong and cites itself (PR1).**

- What goes wrong. An article states a limit or a feature that has changed, and Ask repeats it with a citation. Or it says "any member can create a channel" in a workspace whose admin limited that (M0.8).
- The fix.
  - Every number comes from the contract's constants, and a test fails on a typed size. The 10 GB cap is now fixed, and its article reads `WORKSPACE_STORAGE_MAX`.
  - Each article lists the PRD rows it covers. A test fails when an article covers a row that isn't Shipped, or when a Shipped row has no article. Marking a PRD row shipped therefore fails the build until the guide covers it.
  - Admin settings read as defaults, with "ask an admin", because Ask can't read workspace settings.
- What is left. The test checks coverage, not wording. A reviewer still reads each article diff.

**6. The guide drowns out the workspace (PR1).**

- What goes wrong. A team calls its data pipeline "Conduit". "What's the status of Conduit?" gets the chat app's description.
- The fix. Search runs before the model, so the team's messages are already among the sources. The prompt says the workspace's meaning wins when its sources use the word for something of the team's own, and both get cited when both apply. An eval case seeds a "Conduit pipeline" channel and must cite it.
- What is left. The model can still misjudge an ambiguous question. The eval measures how often.

**7. A longer prompt on every question (PR1).**

- What goes wrong. The catalog goes out with every question, including ones that never touch the guide. Today's system prompt is about 2,000 characters (measured).
- The fix. The catalog lists only slugs and titles, about 50 characters an article, so about 750 characters for 15 (estimated). Summaries come back only if an eval case needs them. The perf rule fails the PR if time to first token grows more than 10% on workspace questions.
- What is left. The catalog grows with the guide. Past about 50 articles, switch to search (Appendix B).

**8. Text files move to a new filter (PR3).**

- What goes wrong. `.txt`, `.csv`, and `.json` files leave "Other files" on the Files page for "Text and code".
- The fix. This is the intended change. The new filter sits in the same Type menu. The type checker lists every place that switches on `FileKind`.
- What is left. Search documents keep the kind they were indexed with, but nothing filters on it (searched in the server and client search code), so no reindex is needed.

**9. Big or broken text files (PR3).**

- What goes wrong. A 30 MB log would be read whole for an 8-line preview, or show nothing because `FileText` stops at 20 MB. A binary named `.txt` would show garbage. A minified file is one 60 KB line.
- The fix. `readRange` reads 64 KB. A cut character is dropped. A NUL byte marks a binary, which shows as a file card. Preview lines are cut at 200 characters. If Shiki on 64 KB blocks the main thread past 200 ms, the viewer highlights only the first 2,000 lines.
- What is left. A file in an encoding other than UTF-8 shows replacement marks. That is rare in code and logs, so the plan leaves it.

**10. Snippet text that is really HTML (PR3).**

- What goes wrong. A snippet holding `<script>` or an `<img onerror>` would run if its text were set as HTML.
- The fix. `CodeBlockContent` renders Shiki's tokens as React text, never as HTML. A client test renders a script snippet and checks no script element exists.
- What is left. None known.

**11. A snippet poses as another kind of file (PR2).**

- What goes wrong. A snippet titled `invoice.pdf` downloads as a "PDF" holding text.
- The fix. `snippetName` makes the extension match the type, so it becomes `invoice.pdf.txt`. Its content type is always `text/plain`.
- What is left. None known.

**12. Copy abuse and double clicks (PR4).**

- What goes wrong. A script calls `files.attach` in a loop, or a member double-clicks Insert.
- The fix. `files.attach` sits behind `arcjet.heavyWrite`, the tier that creating a workspace uses. The 10 GB cap bounds the total. Insert shows a pending state until its calls return.
- What is left. None known.

**13. Uncommitted files.** `button.tsx`, `command.tsx`, and five client files have edits from other work. Each PR branches from `staging` and leaves them out.

## Appendix D. Reading list

- `docs/plans/m3-ask-context.md` for the tools design PR1 extends, and the rule that Ask can't read workspace settings.
- `docs/plans/m3-files-and-search.md` for the upload, cap, and sweep rules PR4 relies on.
- `apps/server/src/ask/application/ask.service.ts` (`tools`, `store`) and `apps/server/src/ask/domain/ask-prompt.ts`.
- `apps/server/src/rooms/infrastructure/prisma-rooms.repository.ts` (`accessibleRoomIds`) for why a public channel's file is safe to copy.
- `apps/client/src/components/code-block.tsx` for the highlighting PR3 reuses.
- `apps/client/src/services/files/upload.ts` and `apps/client/src/components/composer/composer-toolbar.tsx`.
