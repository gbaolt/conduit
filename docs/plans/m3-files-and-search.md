# M3 files and search plan

M3 lets a team share files in chat and find old answers. Today the composer takes text only, and nothing in the app searches. This plan ships the eleven M3 rows in [`PRD.md`](../../PRD.md#m3-files-and-search) as three PRs against `staging`. Files live in a new `files` module on the existing S3 storage. Search lives in a new `search` module on **Upstash Vector**, a hosted hybrid index (BM25 keyword plus `openai/text-embedding-3-small`). Ask Conduit lives in a new `ask` module that reads the same index.

The rule the milestone enforces is that the index only suggests and Postgres decides. The index returns candidate ids. The server then loads each candidate from Postgres through the one access check that the Files page also uses. That check drops anything the member can't read, and anything deleted. The index never decides who sees what, and no message text shown to a member or sent to the model comes from the index. The one exception is a file chunk's text in Ask Conduit, read from the hit because Postgres doesn't keep it. A file's contents never change after upload, and Postgres still decides whether the member can read the file (Appendix B, decision 10). An index that lags, keeps a deleted message, or misses a membership change can only hide a result. It can never show one the member can't read.

| PR  | Ships                                                                      | PRD rows           | Depends on |
| --- | -------------------------------------------------------------------------- | ------------------ | ---------- |
| PR1 | Files, previews, the **Files** page, index sync, and the `Ctrl+K` switcher | M3.1 to M3.6, M3.9 | None       |
| PR2 | Search, its filters, and access-checked results                            | M3.7, M3.8, M3.10  | PR1        |
| PR3 | Ask Conduit                                                                | M3.11              | PR2        |

The exit check's Files page half passes after PR1, its search half after PR2, and the whole check after PR3. PR1 is large, so it lands in five parts, A to E, in order. Each part ends with its own **You see** and **Verify** boxes, and those pass before the next part starts. A reviewer can read PR1 one part at a time.

## How to read this

One box is one unit of work. Check a box only when its evidence exists, such as a test run, a screenshot, or a SHA. The body is a how-to. The appendices explain and record.

Each PR runs under the poteto-mode Feature playbook and opens against `staging`. Each PR is a sequence of commits, one per **Commit** heading below. Each commit ends green on `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Each PR that changes a PRD row's status updates `PRD.md` in the same diff. Each PR that adds a migration says so in the first line of its body, per `conduit-database`.

Tests alone are not sufficient verification. A PR is verified only when its unit and live boxes are all checked. Signed-in flows need a real session, so the operator runs the signed-in live boxes. The agent runs every unit box, every script, and the signed-out checks.

## Data shapes

These shapes come first. Each PR below adds the ones it needs.

| Shape                                    | Lives in                                             | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `File`                                   | Prisma model, app-owned                              | `{ id, organizationId, uploaderId, roomId?, messageId?, name, contentType, size, key, width?, height?, status, indexedChunks, createdAt, deletedAt? }`. `status` is `PENDING \| READY`. `roomId` and `messageId` are set when a message sends with it. `width` and `height` are set for images and videos, so previews hold their space. Indexed on `(organizationId, roomId, createdAt, id)` for the Files page and `(organizationId, status, createdAt)` for the quota and the cleanup sweep. |
| `File.key`                               | a string the server builds                           | `files/<organizationId>/<fileId>/<safe name>`. The `files/` prefix is **private**. The bucket allows public reads only on `workspaces/`, where icons live, so a file URL is always a short-lived presigned GET from the server.                                                                                                                                                                                                                                                                 |
| `FileKind`                               | `packages/contract/src/lib/file-kind.ts`             | `(contentType) => 'image' \| 'video' \| 'pdf' \| 'other'`. Pure, so the composer, the preview, the Files page filter, and the indexer agree.                                                                                                                                                                                                                                                                                                                                                    |
| `FILE_SIZE_MAX`, `WORKSPACE_STORAGE_MAX` | `packages/contract/src/lib/file-limits.ts`           | 50 MB and 10 GB. The PRD marks 10 GB as a placeholder, so it lives in one constant.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Message.fileIds`                        | not a column                                         | A send takes `fileIds`, and the send transaction sets `File.roomId` and `File.messageId`. A message reads its files through the `File` relation.                                                                                                                                                                                                                                                                                                                                                |
| `accessibleRoomIds`                      | `RoomsRepository`                                    | `(viewer) => string[]`. The workspace's public channels, archived ones included, plus every room the viewer is a member of. This is the one access check that the Files page, search, and Ask Conduit all use.                                                                                                                                                                                                                                                                                  |
| `SearchSync`                             | Prisma model, app-owned                              | `{ kind, targetId, organizationId, dueAt, attempts, lastError? }`, primary key on `(kind, targetId)`. `kind` is `MESSAGE \| FILE`. A row means "make the index match Postgres for this target". It is written in the transaction of the change, so a lost write can't happen. Writing it again only moves `dueAt`.                                                                                                                                                                              |
| `SearchDoc`                              | `apps/server/src/search/domain/search-doc.ts`        | What goes into Upstash. `{ id, data, metadata }`. `id` is `message:<id>` or `file:<id>:<n>` for chunk `n`. `data` is the text Upstash embeds and BM25-indexes. `metadata` is `{ kind, roomId, authorId, createdAt (epoch ms), hasFile (0 or 1), parentId?, fileKind? }`, the only fields filters read.                                                                                                                                                                                          |
| `SearchIndex`                            | `apps/server/src/search/domain/search-index.port.ts` | The port: `upsert(org, docs)`, `delete(org, ids)`, `query(org, { text, filter, topK, mode })`. One namespace per workspace. `UpstashSearchIndex` is the only adapter. A fake adapter in `testing/` returns every doc, which is how the access tests prove that Postgres is the guard.                                                                                                                                                                                                           |
| `SearchQuery`                            | `packages/contract/src/lib/search-query.ts`          | `parseSearchQuery(text) => { terms, in?: string[], from?: string[], hasFile, before?, after? }`. Pure, and shared, so the search field can show the filters as chips while the person types.                                                                                                                                                                                                                                                                                                    |
| `SearchHit`                              | `packages/contract/src/schemas/search.ts`            | What `search.query` returns. A union of `{ type: 'message', message, room }`, `{ type: 'file', file, room, excerpt? }`, `{ type: 'channel', room }`, and `{ type: 'person', user }`.                                                                                                                                                                                                                                                                                                            |
| `Answer`                                 | Prisma model, app-owned                              | `{ id, organizationId, requesterId, question, found, body, sources Json, createdAt }`. `found` is false when the model called `cannot_answer`, and then `body` is empty and `sources` is `[]`. `sources` is an array of `{ type: 'message' \| 'file', id }`. Only the requester can read it.                                                                                                                                                                                                    |

**Why one namespace per workspace.** Each request names one namespace, so a bug in a filter can't reach another workspace's documents. Upstash allows 100 namespaces on the free plan and 10,000 on pay as you go.

**Why a sync row that says "reconcile", not an operation log.** The drain reads the target's current state from Postgres. If the target exists and isn't deleted, it upserts the target. Otherwise it deletes the target's ids. Running a row twice, out of order, or after a crash ends in the same index state. Edits, deletes, file uploads, and retries all go through one code path.

**Why channels and people are searched in Postgres.** A workspace has tens of channels and at most 50 people. `ILIKE` on `Room.name` and `User.name` answers that instantly, and it needs no sync when someone renames a channel or changes their name.

## Program checklist

- [ ] Load the skills AGENTS.md names for each PR before writing code. That is `conduit-structure`, `conduit-components`, `mattpocock-skills:codebase-design`, `orpc-contract`, `nestjs-best-practices`, `conduit-database` for PRs with a migration, `vercel-react-best-practices` and `vercel-composition-patterns` for UI, `next-cache-components-optimizer` for the `/files` and `/search` routes, and `next-dev-loop` before reporting a client change done.
- [ ] Every UI commit also loads `design-taste-frontend` and `emil-design-eng`, and reads `DESIGN.md`. Under `design-taste-frontend`, these are app screens, so follow `references/app-screens.md` and run `inspect.mjs --app` on the result. Under `emil-design-eng`, use its animation decision framework and write the review table it requires in the PR body.
- [ ] Ask the operator before installing each package. PR1's Part D needs `@upstash/vector` and `unpdf` in `apps/server`. No other part or PR adds a package. `cmdk` is already in `packages/ui`.
- [ ] Ask the operator to create the Upstash Vector index on a direct Upstash account, before PR1's Commit 8. Choose **Hybrid**, with dense model `openai/text-embedding-3-small`, sparse model **BM25**, and metric cosine. These are fixed at creation. Then set `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN` on the server, locally and on Vercel.
- [ ] Ask the operator to confirm that the S3 bucket's public-read rule covers only `workspaces/`, and that its CORS allows `PUT` from the app origin, before PR1.
- [ ] Number migrations in merge order, starting at `19_`. A PR that merges later renumbers its folder to stay one past the highest.
- [ ] Ask before running any command that writes to a database or to the index, per `conduit-database`. That includes `pnpm db:migrate-deploy`, the backfill in PR1's Commit 11, and every script in `apps/server/scripts/`.
- [ ] Add each new term to `GLOSSARY.md` in the PR that introduces it. The terms are **File**, **Storage cap**, **Search**, **Quick switcher**, and **Ask Conduit**.

## Files, previews, the Files page, index sync, and the quick switcher (PR1, M3.1 to M3.6, M3.9)

**Depends on.** None.

The PR body lists the five parts with their PRD rows, and says in its first line that it adds the migrations `19_files` and `20_search_sync`. Commits number straight through the parts.

### Part A. Upload files and attach them to messages (M3.1, M3.2, M3.5, M3.6)

#### Commit 1. Store files and sign uploads

**Files.**

- [ ] Edit `schema.prisma`. Add `FileStatus` and `File` with foreign keys to `Organization`, `User`, `Room`, and `Message`. Uploader, room, and message are `onDelete: SetNull` or `Cascade`, per `conduit-database`. Write `19_files` from a diff.
- [ ] Edit `apps/server/src/storage/domain/object-storage.ts` and `s3-object-storage.ts`. Add `presignDownload(key, { filename, inline })`, `head(key)`, and `delete(keys)`. `presignUpload` already signs `ContentLength`, so S3 refuses a body of any other size.
- [ ] Create `packages/contract/src/lib/file-kind.ts`, `file-limits.ts`, and their tests.
- [ ] Create `packages/contract/src/schemas/files.ts` and `contracts/files.ts` with `files.uploadUrl`, `files.complete`, and `files.cancel`. Register them in `contract.ts`.
- [ ] Create `apps/server/src/files/` with `domain/files.repository.ts`, `domain/file-errors.ts`, `infrastructure/prisma-files.repository.ts`, `application/files.service.ts` and its test, `presentation/files.controller.ts`, and `files.module.ts`.

**Build.**

- [ ] `files.uploadUrl({ roomId, name, contentType, size })` checks that the caller can post in the room, through `checkChannel`. It refuses `FILE_TOO_LARGE` above 50 MB. In one transaction it sums `size` over the workspace's `PENDING` and `READY` files that aren't deleted, and refuses `STORAGE_FULL` when the new file would pass 10 GB. Otherwise it inserts a `PENDING` row and returns `{ fileId, uploadUrl }`. Counting `PENDING` rows stops two uploads from racing past the cap.
- [ ] `files.complete({ fileId, width?, height? })` lets only the uploader finish. It calls `head` and refuses `UPLOAD_MISSING` when the object is absent or its size differs. Then it sets `READY`. It is idempotent.
- [ ] `files.cancel({ fileId })` deletes a `PENDING` or unattached `READY` file and its object.
- [ ] `STORAGE_FULL` carries `{ used, cap }`, so the client can say "This workspace has used 10 GB of 10 GB. Delete files or ask an admin to free space." The error never mentions billing, because the PRD has no plans.
- [ ] All three procedures chain `authorized`, `arcjet.write`, and `workspaceMember`.

#### Commit 2. Send a message with files

**Files.**

- [ ] Edit `packages/contract/src/schemas/messages.ts`. A send takes `fileIds` (at most 10), and a message carries `files`.
- [ ] Edit `MessagesRepository.send` and `markDeleted`, and `MessagesService.send`.
- [ ] Edit `PrismaMessagesRepository`'s message select to include `files`.

**Build.**

- [ ] A send with `fileIds` checks that each file is `READY`, belongs to the caller, and is unattached. Inside the send transaction it sets each file's `roomId` and `messageId`. A message may have files and an empty body.
- [ ] A retried send attaches nothing new, since its message already exists.
- [ ] `markDeleted` sets `deletedAt` on the message's files. The sweep in Commit 10 removes the objects.

#### Commit 3. Drag, paste, and pick in the composer

**Files.**

- [ ] Create `apps/client/src/services/files/upload.ts`, a `useFileUploads(roomId)` hook that keeps one upload per file with its progress.
- [ ] Create `apps/client/src/components/composer/composer-attachments.tsx`, the row of pending files above the input.
- [ ] Edit `composer.tsx` and `composer-action-bar.tsx`. Add a paperclip button, a drop zone, and paste handling. Lexical's `DragDropPasteExtension` already sees pasted files, so route files there instead of inserting images.
- [ ] Edit `PRD.md`. Mark M3.1, M3.2, M3.5, and M3.6 `Shipped`, and set M3 to `In progress`.

**Build.**

- [ ] Picking, dropping, or pasting a file asks for an upload URL, then `PUT`s with `XMLHttpRequest`, so progress events fire. Each pending file shows its name, its size, a progress ring, and a remove button.
- [ ] Images and videos are measured in the browser before `complete`, so the previews in Commit 5 hold their space.
- [ ] **Send** waits for every upload to finish. It is disabled with the label "Uploading 2 files…" until then.
- [ ] A file over 50 MB is refused before upload with "Files can be up to 50 MB. This one is 72 MB." `STORAGE_FULL` shows its message inline in the attachment row, not as a toast, so it stays until the person acts.
- [ ] Dragging over the conversation shows a full-panel drop target that reads "Drop to share in #design". Under `emil-design-eng`, it appears with a 150 ms opacity fade on `ease-out`, and nothing scales from zero.
- [ ] Until Commit 5, a message with files shows each one as a file card with an icon, the name, and the size, opening a download.

**You see.**

- [ ] A member drags a PDF into #design, watches it upload, and sends it with a line of text. The other browser shows the message with the file card.
- [ ] Pasting a screenshot attaches it. The paperclip picks several files at once.
- [ ] A 60 MB file is refused before upload. With the cap lowered to 1 MB in a test build, the next upload shows the storage-full message.

**Verify, unit.**

- [ ] `file-kind.test.ts` and `file-limits.test.ts` cover each content type and both limits.
- [ ] Service tests, with `TEST_DATABASE_URL` set, cover the cap counting `PENDING` rows, two uploads racing at the edge of the cap, `complete` with a wrong size, another member trying to attach your file, attaching to a room you can't post in, a retried send, and delete marking files deleted.
- [ ] Run `pnpm --filter @conduit/contract test`, `pnpm --filter server test`, and `pnpm --filter client test`.

**Verify, live.**

- [ ] Agent. Upload a 50 MB file with `curl` to a presigned URL that signed 1 KB, and record that S3 refuses it.
- [ ] Operator. Run **You see** in two browsers, at 360 px, in both themes, and with the keyboard only.

### Part B. Preview images, video, and PDFs inside the message (M3.3)

#### Commit 4. Serve a file to someone who can read it

**Files.**

- [ ] Add `RoomsRepository.accessibleRoomIds(viewer)` and its test. It lands here because `downloadUrl` is its first caller.
- [ ] Add `files.downloadUrl({ fileId, inline })` to the contract and `FilesService`.

**Build.**

- [ ] `downloadUrl` loads the file and its room, refuses `NOT_FOUND` unless the room is in `accessibleRoomIds(viewer)` and the file isn't deleted, and returns a presigned GET that lasts 10 minutes. `inline` sets `Content-Disposition` to `inline` for previews and to `attachment` with the original name for downloads.
- [ ] A refused file and a missing file return the same `NOT_FOUND`, so the response can't confirm that a file exists.

#### Commit 5. Render previews

**Files.**

- [ ] Create `apps/client/src/features/messages/components/message-files.tsx`, plus `message-file-image.tsx`, `message-file-video.tsx`, and `message-file-pdf.tsx`.
- [ ] Create `apps/client/src/features/messages/components/file-viewer.tsx`, a `Dialog` that shows one file large, with **Download**.
- [ ] Edit `PRD.md`. Mark M3.3 `Shipped`.

**Build.**

- [ ] An image renders at its stored aspect ratio, capped at 360 by 360 px, with a `Skeleton` of that exact size until it loads, so the log never shifts. Several images form a grid of up to four, and the rest show as "+3".
- [ ] A video renders `<video controls preload="metadata">` at its stored size. It never autoplays.
- [ ] A PDF renders as a card with the name, the size, and an **Open** button. **Open** shows the browser's own PDF viewer in `file-viewer.tsx`, in an `iframe` with the inline URL.
- [ ] Every other type renders the file card from Commit 3.
- [ ] Clicking an image opens `file-viewer.tsx`. Under `emil-design-eng`, the dialog grows from the clicked thumbnail with `transform-origin` set to it, over 200 ms on a strong `ease-out`. It honors `prefers-reduced-motion` with an opacity fade only. **Esc** closes it, and focus returns to the thumbnail.
- [ ] Every preview has a text alternative, which is the file name, and the arrow keys move between files in the grid.
- [ ] A presigned URL expires after 10 minutes, so a preview that fails to load fetches a fresh URL once before showing "Couldn't load this file".

**You see.**

- [ ] A member sends three photos, a short video, and a PDF. The other browser shows the grid, the player, and the PDF card. The log doesn't jump as they load.
- [ ] Opening the PDF shows it in the viewer. **Download** saves it with its original name.

**Verify, unit.**

- [ ] Service tests cover `downloadUrl` for a member, a non-member of a private channel, a public channel the caller hasn't joined, and a deleted file.

**Verify, live.**

- [ ] Agent. Copy a presigned URL, wait 11 minutes, and record that it returns 403.
- [ ] Operator. Run **You see** at 360 px, in both themes, and with the keyboard only.

### Part C. Show every file you can access on the Files page (M3.4)

#### Commit 6. List files

**Files.**

- [ ] Add `files.list({ roomId?, uploaderId?, kind?, name?, before?, limit })` to the contract and `FilesService`.

**Build.**

- [ ] `files.list` returns `READY`, attached, non-deleted files whose room is in `accessibleRoomIds(viewer)`, newest first by `(createdAt, id)`. Each row carries the file, its room, its uploader, and its message id.
- [ ] `kind` filters through `FileKind`'s content-type groups. `name` is `ILIKE`.
- [ ] It chains `authorized`, `arcjet.read`, and `workspaceMember`.

#### Commit 7. The Files page

**Files.**

- [ ] Create `apps/client/src/app/(dashboard)/(home)/files/page.tsx`. Prefetch the first page inside `<Suspense>` and wrap it in `HydrateClient`, as the Activity page does.
- [ ] Create `apps/client/src/features/files/components/files-table.tsx`, `files-toolbar.tsx`, and `files-filters.tsx`. Add `files` to `featureDeps` in `apps/client/eslint.config.mjs`, allowed to import `rooms` and `messages`.
- [ ] Edit `apps/client/src/components/app-shell.tsx`. Add a **Files** rail link.
- [ ] Edit `PRD.md`. Mark M3.4 `Shipped`.

**Build.**

- [ ] The page is a full-width `Table`, per `DESIGN.md`, with columns for name with a kind icon, channel or DM, uploader, size, and date. Below 640 px each row collapses to two lines.
- [ ] The toolbar holds a filter control for channel, person, and type, and a search icon that opens a name field, beside the filter control, per `DESIGN.md`. Each filter trigger shows its current value, or "Any".
- [ ] The filters live in the URL through nuqs, so a filtered view can be shared.
- [ ] Clicking a row opens the file in `file-viewer.tsx`. **Jump to message** opens the message in its conversation.
- [ ] No files shows `Empty`, centered. No matches shows `Empty` with a **Clear filters** action.
- [ ] The loading state is `Skeleton` rows sized to the loaded table, measured with Playwright, per `DESIGN.md`.

**You see.**

- [ ] Member A uploads a PDF to a private channel that B isn't in, and an image to #general. B's Files page shows the image and not the PDF. A's shows both.
- [ ] B filters by person, then by type, then by name, and each step narrows the table.

**Verify, unit.**

- [ ] Service tests cover the private-channel case above, a DM between two other people, an archived public channel, a deleted file, and paging with equal `createdAt`.

**Verify, live.**

- [ ] Operator. Run **You see** at 360 px, in both themes, and with the keyboard only.

### Part D. Keep Upstash Vector in sync with messages and files

Part D ships no PRD row by itself. PR2 and PR3 read what it writes.

#### Commit 8. Probe Upstash before building on it

**Files.**

- [ ] Create `apps/server/scripts/probe-search.ts`. It writes to a namespace named `probe-<timestamp>` and deletes the namespace at the end.

**Build.**

- [ ] The probe answers the open questions in Appendix A and prints one line per answer. It upserts 5,000 synthetic messages across 300 room ids, then checks the following.
  - [ ] Filter length. It runs `roomId IN (...)` with 50, 300, and 1,000 ids and records whether each one works.
  - [ ] Recall under a selective filter. It runs a query whose only matches sit in one room, with `topK` 20 and a filter on that room. It records how many of the matches come back.
  - [ ] Freshness. It records the time from an upsert's response until a query finds the new document.
  - [ ] Query modes. It confirms that a hybrid index accepts a sparse-only (keyword) query and a hybrid query, and records which fusion it uses.
  - [ ] Latency. It records p50 and p95 for 200 queries from the Vercel region.
- [ ] Paste the output into the PR body. When recall under a selective filter comes back below 90%, stop and take Appendix D's fallback to the operator before Commit 9. Parts A to C don't depend on the answer, so they can keep moving while the operator decides.

#### Commit 9. Write sync rows with every change

**Files.**

- [ ] Edit `schema.prisma`. Add `SearchSyncKind` and `SearchSync`, and `File.indexedChunks Int @default(0)`. Write `20_search_sync`.
- [ ] Create `apps/server/src/search/` with `domain/search-doc.ts`, `domain/search-index.port.ts`, `domain/search-sync.repository.ts`, `infrastructure/prisma-search-sync.repository.ts`, `testing/fake-search-index.ts`, and `search.module.ts`.
- [ ] Edit `MessagesRepository.send`, `edit`, and `markDeleted`, and `FilesRepository`'s `complete`, `attach`, and delete paths. Each upserts a `SearchSync` row inside its transaction.

**Build.**

- [ ] `toSearchDocs(message)` and `toSearchDocs(file, text)` in `search-doc.ts` are pure. A message is one doc, since 4,000 characters fits Upstash's 1 MB limit. Its `data` is the Markdown body with mention tokens replaced by names. A file is chunk 0 with its name, plus one chunk per 2,000 characters of extracted text, at most 200 chunks.
- [ ] A reaction, a pin, or a read changes nothing the index holds, so it writes no row.

#### Commit 10. Drain the rows into Upstash

**Files.**

- [ ] Create `infrastructure/upstash-search-index.ts` and `application/search-sync.service.ts` with its test.
- [ ] Create `infrastructure/storage-file-text.ts`, which extracts text with `unpdf` for PDFs and reads `text/*` files directly. It reads a PDF page by page and stops once the text fills 199 chunks, since parsing blocks the event loop the API's other requests share (Appendix A). A PDF that fails to parse is found by its name only.
- [ ] Edit `messages.controller.ts` and `files.controller.ts`. After commit, call `waitUntil(searchSync.drain(organizationId))`, as link previews do.
- [ ] Create `presentation/search-sync.controller.ts` with `POST /internal/search-sync`, behind `CRON_SECRET`, as `digests.controller.ts` does.
- [ ] Create `.github/workflows/search-sync.yml`, which calls it every 15 minutes, as `email-digest.yml` does.

**Build.**

- [ ] `drain(organizationId?, limit = 100)` claims due rows with `FOR UPDATE SKIP LOCKED`, so two drains never take the same row. For each row it reads the target's current state. A live target is upserted, and the ids of chunks past its new count are deleted. A deleted or missing target has all its ids deleted. On success the row is removed. Claiming a row counts as an attempt, so a drain killed mid-row by the function's time limit still backs off. The lease is 5 minutes, or the row's retry delay when that is longer. On failure it sets `lastError` and pushes `dueAt` back by `2^attempts` minutes, capped at 6 hours. `drain({ until })` hands rows it had no time for back to the queue, due now and uncounted.
- [ ] The sweep endpoint drains every workspace until 240 seconds have passed, under Vercel's 300-second limit, so a backlog spreads across runs. It also deletes `PENDING` files older than 24 hours, and the objects of deleted files, through `ObjectStorage.delete`.
- [ ] Deleting a workspace deletes its namespace.
- [ ] Upstash being down never fails a send. The row stays and retries.

#### Commit 11. Backfill

**Files.**

- [ ] Create `apps/server/scripts/backfill-search.ts`.
- [ ] Edit `PRD.md`. Under **Current stack**, name Upstash Vector as the search index and S3 as file storage.

**Build.**

- [ ] The backfill inserts a `SearchSync` row for every non-deleted message and `READY` file, in pages of 1,000, with `ON CONFLICT DO NOTHING`. Then it drains until no rows are due. It is idempotent, so it can be stopped and rerun.
- [ ] It prints the row count before writing and asks for `--yes`. Every upserted vector is one billed request, and the free plan stops at 10,000 a day.

**You see.**

- [ ] Sending, editing, and deleting a message each leave no `SearchSync` row behind within a few seconds, and the Upstash console shows the doc appear, change, and disappear.
- [ ] With the Upstash token unset, a send still works, and its row stays with `lastError` set. Restoring the token and calling the sweep clears it.

**Verify, unit.**

- [ ] `search-doc.test.ts` covers mention replacement, a 4,000-character body, a PDF that shrinks from five chunks to two, and the 200-chunk cap.
- [ ] `search-sync.service.test.ts`, against `fake-search-index.ts` and `TEST_DATABASE_URL`, covers a row drained twice, a delete landing before its upsert, two concurrent drains, a failure and its backoff, a drain that died mid-row, rows handed back at the deadline, and a retried send writing one row.
- [ ] `storage-file-text.test.ts` covers a PDF's text, a long PDF stopped at the cap, and a broken PDF.

**Verify, live.**

- [ ] Agent. Run `probe-search.ts` against a probe namespace and paste its output.
- [ ] Agent. Rerun `apps/server/scripts/measure-delivery.ts` against `staging` and the PR's preview, with a send that carries one file. Fail at a head p95 of 200 ms or more, or 20 ms or more above `staging`, since the send transaction gains the file attach and one sync row.
- [ ] Operator. Run the backfill on the dev database with `--yes`, then record the row count and the Upstash request count.

### Part E. Jump anywhere with Ctrl+K (M3.9)

Part E reads only data the sidebar already loads, so it depends on no other part. Once PR2 merges, its last row hands off to search.

#### Commit 12. The quick switcher

**Files.**

- [ ] Create `apps/client/src/features/rooms/components/room-switcher.tsx`, built on `Command` from `@conduit/ui/components/command`.
- [ ] Edit `apps/client/src/components/app-shell.tsx`. Register the shortcut once, and add a search button to the rail that opens the switcher.
- [ ] Edit `composer.tsx` and `composer-toolbar.tsx`. Move **Insert link** from `Ctrl+K` to `Ctrl+Shift+U`, per Appendix B decision 6.
- [ ] Edit `PRD.md`. Mark M3.9 `Shipped`.

**Build.**

- [ ] `Ctrl+K`, or `⌘K` on a Mac, opens the switcher from anywhere, including from inside the composer. It lists the member's channels and DMs from the sidebar query, and public channels they haven't joined from `channels.list`.
- [ ] With an empty query it shows recent conversations first, then unread ones. Typing ranks by cmdk's fuzzy match, with starred conversations breaking ties.
- [ ] Rows follow `DESIGN.md`'s fixed-height picker rule. Each row has the icon or avatar, the name, and an unread dot. The highlighted row's topic or members show in a footer strip.
- [ ] Once PR2 merges, the last row reads "Search for “<query>”" and opens `/search?q=<query>`. Once PR3 merges, the row after it reads "Ask Conduit “<query>”".
- [ ] Under `emil-design-eng`, the switcher has **no** open or close animation. People open it many times a day from the keyboard, and the framework says those actions never animate.
- [ ] Focus moves into the field on open, and returns to where it was on **Esc**.

**You see.**

- [ ] From the composer, `Ctrl+K`, type "des", **Enter**. #design opens with focus in its composer.
- [ ] `Ctrl+Shift+U` in the composer inserts a link.

**Verify, unit.**

- [ ] A component test covers the ranking order with an empty query and with a typed query, and **Esc** returning focus.

**Verify, live.**

- [ ] Operator. Run **You see** at 360 px, in both themes, and with the keyboard only. Record that the switcher appears on the first frame after the key press.

## Search messages, files, channels, and people (PR2, M3.7, M3.8, M3.10)

**Depends on.** PR1.

### Commit 1. Parse the query

**Files.**

- [ ] Create `packages/contract/src/lib/search-query.ts` and its test.

**Build.**

- [ ] `parseSearchQuery` reads `in:#channel`, `in:@person` for a DM, `from:@person`, `has:file`, `before:YYYY-MM-DD`, and `after:YYYY-MM-DD`, in any order and any case. A filter may repeat, as in `in:#a in:#b`. Anything else is a term. A malformed filter, such as `before:soon`, stays a term, so typing never throws.
- [ ] `before:` and `after:` are dates in the member's time zone, from `NotificationSettings.timeZone`, as Do Not Disturb uses.

### Commit 2. Run the search

**Files.**

- [ ] Create `packages/contract/src/schemas/search.ts` and `contracts/search.ts` with `search.query`. Register it in `contract.ts`.
- [ ] Create `apps/server/src/search/application/search.service.ts` with its test, and `presentation/search.controller.ts`.

**Build.**

- [ ] `search.query({ text, type?, limit })` parses the text. It resolves `in:` and `from:` names to ids in Postgres, and keeps only the rooms in `accessibleRoomIds(viewer)`. A filter that names nothing the caller can read returns no results, with no error that would confirm the room exists.
- [ ] Messages and files go to `SearchIndex.query` in the workspace's namespace. The filter is `roomId IN (<rooms>)` plus the parsed filters on `authorId`, `createdAt`, and `hasFile`. The query uses the hybrid mode, with `topK` at three times `limit`.
- [ ] The service hydrates every hit from Postgres in one query per type. It keeps only rows that exist, aren't deleted, and sit in an accessible room, and it keeps the index's order. The text a member sees is always the Postgres text.
- [ ] Channels and people come from Postgres with `ILIKE`. Channels are limited to accessible ones, and people to active members of the workspace.
- [ ] With no terms but some filters, as in `from:@linh has:file`, messages and files come from Postgres, newest first, since there is nothing to rank.
- [ ] It chains `authorized`, `arcjet.read`, and `workspaceMember`.

### Commit 3. The search page

**Files.**

- [ ] Create `apps/client/src/app/(dashboard)/(home)/search/page.tsx`, with the query in `?q=` through nuqs.
- [ ] Create `apps/client/src/features/search/components/search-field.tsx`, `search-results.tsx`, `search-hit.tsx`, and `search-tabs.tsx`. Add `search` to `featureDeps`, allowed to import `rooms`, `messages`, and `files`.
- [ ] Create `packages/contract/src/lib/highlight-terms.ts` and its test.
- [ ] Edit `PRD.md`. Mark M3.7, M3.8, and M3.10 `Shipped`.

**Build.**

- [ ] The field shows each parsed filter as a `Tag` chip as the person types, with an **x** to remove it. Typing `in:` or `from:` opens the same fixed-height typeahead rows the mention menu uses, per `DESIGN.md`.
- [ ] Tabs for **Messages**, **Files**, **Channels**, and **People** sit under the header with no top border, per `DESIGN.md`. Each tab shows its count.
- [ ] A message hit shows the author, the room, the time, and the body through `MessageMarkdown`, with matched terms wrapped in `<mark>` by `highlightTerms`. **Enter** opens the message in its conversation, or in its thread panel for a reply.
- [ ] A file hit shows the Files page row from PR1. A channel hit opens the channel, or a preview for a public one the member hasn't joined. A person hit opens a DM.
- [ ] No results shows `Empty`, with a suggestion to remove the most narrowing filter, such as "Try without `before:`".
- [ ] Results move with the arrow keys and work at 360 px.

**You see.**

- [ ] The exit check's search half. A uploads a PDF to a private channel that B isn't in. A finds it by a word inside the PDF. B searching the same word sees nothing from that channel. B searching the file name sees nothing.
- [ ] `from:@a has:file after:2026-11-01` narrows to A's files since that date.
- [ ] A deletes a message. Searching its words right away no longer shows it, even before the index catches up.
- [ ] B is removed from a channel. B's next search no longer shows its messages.

**Verify, unit.**

- [ ] `search-query.test.ts` covers each filter, repeats, mixed case, malformed filters, and quoted names with spaces.
- [ ] `search.service.test.ts` runs against `fake-search-index.ts`, which returns every doc it holds. It covers a private channel the caller isn't in, a DM between two other people, a deleted message, a deleted file, a room the caller just left, an `in:` naming a private channel, and another workspace's ids. Each must be absent from the results. This test is the access proof, because the fake index hides nothing.

**Verify, live.**

- [ ] Agent. Create `apps/server/scripts/measure-search.ts`, which times 200 `search.query` calls against the preview. Fail at a p95 of 500 ms or more, end to end on the server.
- [ ] Operator. Run **You see** in two browsers, at 360 px, in both themes, and with the keyboard only.

## Answer questions from what the team wrote (PR3, M3.11)

**Depends on.** PR2.

### Commit 1. Chunk file text on sentences, with overlap

This lands before the first successful backfill, because changing chunks after it re-indexes every PDF against the same daily request limit.

**Files.**

- [ ] Edit `apps/server/src/search/domain/search-doc.ts` and `search-doc.test.ts`.

**Build.**

- [ ] `fileDocs` packs paragraphs, then sentences, into chunks of at most 2,000 characters. Each chunk after the first repeats the last 300 characters of the one before, cut at a word. A sentence longer than a chunk is split at words. Chunk 0 stays the file name, and the 200-chunk cap stays.
- [ ] `FILE_TEXT_CHARS_MAX` still bounds how much of a PDF is read.

**Verify, unit.**

- [ ] `search-doc.test.ts` proves that no chunk ends mid-word, that each later chunk starts with the end of the one before, and that a 400-page PDF still makes at most 200 chunks.

### Commit 2. Retrieve, answer, and cite

**Files.**

- [ ] Edit `schema.prisma`. Add `Answer`. Write `21_answers`.
- [ ] Create `packages/contract/src/schemas/ask.ts` and `contracts/ask.ts` with `ask.question`, which streams through an event iterator like `summaries.room`, and `ask.get`.
- [ ] Create `apps/server/src/ask/` with `domain/ask-prompt.ts` and its test, `application/ask.service.ts` and its test, `infrastructure/prisma-answers.repository.ts`, `presentation/ask.controller.ts`, and `ask.module.ts`.
- [ ] Create `apps/server/scripts/eval-ask.ts`, beside `eval-summaries.ts`.
- [ ] Edit `search-index.port.ts` and `upstash-search-index.ts`. A query can ask for `includeData`, and a hit then carries `data`.

**Build.**

- [ ] `ask.question({ question })` refuses `AI_DISABLED` when the workspace turned AI off, through `AiAccessService`.
- [ ] It calls `SearchService` with the question, in hybrid mode with `topK` 30 and `includeData`. It gets back only hydrated, accessible, non-deleted messages and file chunks, so the model can't see anything the member can't. A message's text comes from Postgres. A file chunk's text comes from the hit's `data`, and only after Postgres has passed the file. For each message that is a thread reply, it adds the thread's root for context.
- [ ] `ask-prompt.ts` wraps each source in a numbered tag, with its room, author, and time, and tells the model to answer only from the sources, and to cite each claim as `[n]`. Message text is treated as data, as the summary prompt does.
- [ ] The model gets one tool, `cannot_answer`, and calls it when the sources don't answer the question. The service then stores the `Answer` with `found` false, and the dialog shows its empty state. No code reads the streamed text to decide whether an answer was found.
- [ ] The answer streams, and the reasoning trace is never sent, per `DESIGN.md`. When it finishes, the service keeps only the citations whose numbers exist, maps them to `sources`, and stores the `Answer`.
- [ ] Generation outlives the request. Fluid Compute cancels a request whose client leaves, so the model call doesn't take the request's abort signal. The service passes `result.consumeStream()` to `waitUntil` and stores the `Answer` in `onFinish`. Closing the dialog mid-answer still saves the answer, and `ask.get` returns it. One model call over 30 sources sits well under the 300-second limit.
- [ ] Only the requester can `ask.get` an answer.

### Commit 3. The Ask Conduit dialog

**Files.**

- [ ] Create `apps/client/src/features/ask/components/ask-dialog.tsx` and `ask-sources.tsx`. Add `ask` to `featureDeps`.
- [ ] Create `apps/client/src/services/ask/hooks.ts`.
- [ ] Edit `app-shell.tsx`, `command-menu-dialog.tsx`, and `search-results.tsx`. Add the **Ask Conduit** button in the top bar's right column, an **Ask Conduit** row in the command menu, and a button on the search page.
- [ ] Edit `PRD.md`. Mark M3.11 `Shipped`, and mark M3 `Shipped` once the exit check passes.

**Build.**

- [ ] Ask Conduit opens in a `Dialog`, per `DESIGN.md`. The question sits at the top. The answer streams through `Markdown`, with `AILoader` in the leading slot and shimmer status text, "Searching what you can access…", until the first token arrives.
- [ ] Each `[n]` renders as a small link pill in `text-link` that opens its source. Below the answer, **Sources** lists each one with its room, author, and time, or the file name.
- [ ] There is no **Share to thread**, per Appendix B decision 5.
- [ ] With AI off, the top bar button, the command menu row, and the search page button are gone.
- [ ] An `Answer` with `found` false shows `Empty` with "I couldn't find that in what you can access", and no **Sources**.

**You see.**

- [ ] The exit check's Ask half. A asks "what's in the Q3 pricing PDF?" and gets an answer citing the private channel's PDF. B asks the same and gets "I couldn't find that in what you can access", and none of B's sources come from that channel.
- [ ] Each citation opens the right message or file.

**Verify, unit.**

- [ ] `ask.service.test.ts`, with a fake `ModelPort` and `fake-search-index.ts`, proves that the prompt never contains text from an inaccessible room or a deleted message, that a citation to a number that doesn't exist is dropped, that a `cannot_answer` call stores an `Answer` with `found` false, and that an answer whose reader stopped reading midway is still stored.
- [ ] `eval-ask.ts` runs ten fixed questions over a fixed corpus, two of them with no answer in the corpus. It fails when an answer cites a source that doesn't support it, misses a source that does, or answers a question it should have refused with `cannot_answer`. Record its score in the PR body.

**Verify, live.**

- [ ] Operator. Run the whole exit check in two browsers, at 360 px, in both themes, and with the keyboard only.

## Close the milestone

- [ ] Every PRD row in M3 reads `Shipped` with its PR link, and the milestone table reads `Shipped`.
- [ ] The exit check passes on `staging`. A member uploads a PDF to a private channel. A member outside that channel can't find it in search or on the **Files** page, and Ask Conduit doesn't use it in their answers.
- [ ] The delivery probe still shows p95 under 200 ms on `staging`.
- [ ] Record the Upstash request count and bill for the first full week in the PR that closes M3, since the docs don't say whether embedding is billed separately.

## Appendix A. Prototype evidence

No prototype ran for this plan. These facts were observed or read on 2026-11-21, at `fb14fa5` on `staging`.

- The dev Neon database runs Postgres 18.7 and holds 122 messages. Measured with a read-only query.
- `S3ObjectStorage.presignUpload` already signs `ContentLength`, so S3 enforces the 50 MB cap at upload. Read from source.
- The bucket serves `workspaces/` publicly for icons, per `apps/server/.env.example`. Files need a private prefix and presigned GETs.
- `messages.controller.ts` already runs link previews and notifications in `waitUntil` after commit, and `digests.controller.ts` already serves an `/internal` endpoint behind `CRON_SECRET` that a GitHub workflow calls every 15 minutes. PR1's Part D copies both.
- `composer.tsx` binds `Ctrl+K` to **Insert link**. PR1's Part E has to move it.
- `cmdk` and `command.tsx` already exist in `packages/ui`.
- Upstash's getting-started page for Upstash Search says "Creating new Upstash Search databases is no longer supported. For new projects, use Upstash Vector instead." Read on 2026-11-21.
- From the Upstash Vector docs and pricing page. A hybrid index pairs BM25 with `openai/text-embedding-3-small` (the BGE models are closed to new indexes). Data can be up to 1 MB per vector and metadata up to 48 KB. Filters support `IN`, `AND`, `OR`, and numeric comparisons. Filtering mixes pre- and post-filtering, so a selective filter "may return fewer than topK". Each request names one namespace. Free is 10K queries and updates per day, 1 GB, 100 namespaces, and no SLA. Pay as you go is $0.40 per 100K requests, plus $0.25 per GB, with a 99.9% SLA. Fixed is $60 a month for 1M requests a day. Every upserted vector counts as one request.

Measured on 2026-11-22 on the operator's Windows machine with Node 26 and `unpdf`, on generated text-only PDFs.

- Parsing a whole 19.5 MB, 3,500-page PDF with `extractText` took 9.2 s, blocked the event loop for all of it, and added 667 MB of memory. A 5.5 MB PDF blocked it for 2.4 s.
- Reading the same PDF page by page and stopping at 400,000 characters took 0.36 s and added 62 MB. That's why the reader stops at the cap. A real PDF with images holds less text per megabyte, so these are worst cases.

These stay unproven until the probe in PR1's Commit 8 runs.

- How long a `roomId IN (...)` filter can be. A member's accessible rooms are every public channel plus their private channels and DMs. That's my estimate of under 300 ids for a 50-person team, not a measurement.
- Recall under a selective filter, such as `in:#one-channel`.
- How soon an upsert is searchable.
- Whether embedding is billed apart from requests. The docs don't say.
- Query latency from the Vercel region.

## Appendix B. Decisions

Defaults the owner applies unless the operator says otherwise.

1. **Upstash Vector is the index, on a direct Upstash account.** The operator chose a hosted engine over Postgres, and Upstash over Typesense and Algolia. Upstash Search is closed to new databases. The Vercel Marketplace sells the same product, so a direct account changes only where the bill lands.
2. **The index suggests and Postgres decides.** See the opening rule. It is why access, deletes, and edits are correct without the index being up to date.
3. **Access is computed per query from Postgres, not stored in the index.** A membership change never needs an index write.
4. **Public channels a member hasn't joined are searchable.** They are readable by anyone in the workspace, so M3.10's "can access" includes them, as it does in Slack. The operator could limit search to joined rooms instead, which is a change to `accessibleRoomIds` alone.
5. **An answer can't be shared to a thread.** An answer can cite rooms that the people in a thread can't read, so sharing it could leak a private channel. The AI rules allow keeping it private. Sharing could come later, limited to answers whose sources are all readable by every member of the target room.
6. **`Ctrl+K` opens the switcher everywhere, and Insert link moves to `Ctrl+Shift+U`.** That matches the shortcut most teams know from Slack. The operator could keep `Ctrl+K` for links inside the composer instead. Then the switcher opens only when focus is outside the composer.
7. **PDFs and plain text are indexed by content. Images and videos are indexed by name only.** OCR and transcripts cost model calls on every upload, and the PRD doesn't ask for them.
8. **A file indexes at most 200 chunks, about 400,000 characters.** That bounds what one upload can cost in requests. Text past the cap is unsearchable, and the file still shows on the Files page.
9. **No reranking.** Upstash charges extra for it, and the docs disagree on how much. PR3's eval decides whether it earns a place.
10. **Ask Conduit reads a file chunk's text from the index hit.** Postgres doesn't store extracted text, a file's contents never change after upload, and Postgres decides whether the file can be read before any chunk reaches the model. The operator could add a `FileChunk` table instead, so that no text sent to the model comes from the index. That costs a migration and keeps chunk text in two places.
11. **Search sync stays in the API, not in a separate functions app.** Counting each claim as an attempt, a time budget on the sweep, and a capped PDF reader cover what a separate app would. Parsing still runs on an instance that serves members, for at most about 0.4 s per PDF (Appendix A).

## Appendix C. Alternatives rejected

- **Postgres on Neon (tsvector, pg_trgm, and pgvector, or Neon's `lakebase_text` BM25).** It needs no vendor and no sync job, and AI Gateway embeddings would cost about $0.03 a month for a 50-person team (my estimate). The operator preferred a hosted engine. The `SearchIndex` port keeps this a one-adapter swap.
- **Upstash Search.** Closed to new databases, its pricing page returns 404, and it caps documents at 1,500 characters.
- **Typesense Cloud.** A real search engine with typo tolerance and in-cluster embeddings, at about $22 to $43 a month flat. It isn't on the Marketplace, and costs more than Upstash at our volume.
- **Algolia.** No vector search below Elevate, which needs an annual contract. Ask Conduit would need a second store.
- **Store each member's accessible rooms in the index, or use a scoped key per member.** Every join, leave, and privacy change would then need index writes, and a missed write would leak results.
- **Render results from the index's stored text.** A deleted or edited message would show its old text until the sync caught up.
- **Upload through the API.** Vercel caps a request body at 4.5 MB, and the PRD asks for browser-to-S3 uploads.

## Appendix D. Risks

- **A selective filter returns too few results.** PR1 and PR2. Upstash mixes pre- and post-filtering, so `in:#one-channel` could miss matches. The probe in PR1's Commit 8 measures it. If recall is under 90%, the fallback is to answer `in:` searches for one or two rooms from Postgres `ILIKE`, which a small room handles fine. That's a change inside `SearchService`, but it's the operator's call, since it gives those searches a second ranking.
- **The accessible-room filter outgrows Upstash's filter length.** PR2. A workspace with hundreds of public channels makes a long `IN` list. The probe in PR1's Commit 8 finds the limit. Past it, the query runs without the room filter at a larger `topK`, and Postgres hydration still drops what the member can't read. That's correct, but recall drops.
- **PR1 is large.** It holds twelve commits, two migrations, and four screens. A problem in one part holds back the rest. The parts land in order with their own checks, so a reviewer can stop at the first part that fails. If the probe stalls Part D, Parts A to C and E still finish and wait in the same branch.
- **The free plan's 10K requests a day.** PR1. Every upserted vector is a request, so a backfill or a busy day can hit the cap. Sync rows then wait and retry, and search shows stale results but never wrong ones. Moving to pay as you go removes the cap.
- **Upstash changes or retires the product.** Upstash just closed Search to new databases. Everything sits behind `SearchIndex`, and the backfill rebuilds any adapter from Postgres.
- **The free plan has no SLA.** When Upstash is down, search and Ask Conduit fail with "Search is unavailable right now", and sends, uploads, and the Files page keep working.
- **A PDF fails to extract or is huge.** PR1. `unpdf` can choke on scanned or broken PDFs. The file then indexes by name only, with a warning in the server log, and the row finishes. A huge PDF is read only up to the 200-chunk cap, so it blocks the event loop for at most about 0.4 s. A drain killed mid-row still counts the attempt and backs off.
- **A presigned URL leaks.** PR1. Anyone with it can read the file for 10 minutes. URLs are only issued after the access check, and they never go into a message body.
- **Orphaned uploads fill the cap.** PR1. `PENDING` rows count toward the cap until the 24-hour sweep deletes them. `files.cancel` handles the common case, a file removed from the composer, right away.
- **A message tries to steer Ask Conduit.** PR3. The prompt treats sources as data, and the worst case is a misleading answer in the asker's own dialog, with its sources listed.

## Appendix E. Reading list

- `PRD.md`, the M3 section and the AI rules, and `GLOSSARY.md`.
- `DESIGN.md`, in full, before any UI commit.
- [`m2-activity-and-notifications.md`](m2-activity-and-notifications.md) for the `waitUntil`, the `/internal` endpoint, and the GitHub workflow patterns PR1's Part D reuses.
- `apps/server/src/storage/` for the presign pattern PR1's Part A extends.
- `apps/server/src/messages/infrastructure/prisma-messages.repository.ts` for the send transaction.
- `apps/server/src/summaries/` for the prompt, citation, and streaming patterns PR3 reuses.
- `packages/contract/src/lib/channel-policy.ts` for `checkChannel`.
- Upstash Vector's [hybrid indexes](https://upstash.com/docs/vector/features/hybridindexes), [filtering](https://upstash.com/docs/vector/features/filtering), [namespaces](https://upstash.com/docs/vector/features/namespaces), and [pricing](https://upstash.com/pricing/vector) before PR1's Part D.
- The `design-taste-frontend` skill's `references/app-screens.md`, and the `emil-design-eng` skill's animation decision framework, before PR1's composer commit and every later UI commit.
