# M4 canvas plan

M4 adds collaborative canvases to Conduit. Members can open a canvas as a channel tab or create a standalone canvas shared with chosen people, edit together with live cursors, comment on selected text, use mentions and checklists, embed messages, restore older versions, and turn a thread into a canvas draft with AI.

The rule this milestone enforces is that Postgres decides access and owns durable history, while Liveblocks synchronizes live Yjs edits and cursors. Every editor builds on `apps/client/src/components/editor/` with a floating selection toolbar and a `/` command menu, with no fixed formatting toolbar.

The seven M4 rows in [`PRD.md`](../../PRD.md#m4-canvas) ship as five stacked PRs against `staging`. PR1 ships the canvas model, channel tab, standalone sharing, and editor (M4.1, M4.4). PR2 ships Liveblocks multi-user editing and cursors (M4.2). PR3 ships inline comments and embedded messages (M4.3, M4.5). PR4 ships version history (M4.6). PR5 ships AI thread to canvas drafts (M4.7).

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md` against `staging`, because PR2 through PR5 build sequentially on PR1 and every PR changes a user-facing interaction. The operator reviews every PR in chat with screenshots and a video and lands the verified stack bottom-up.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:.agents/skills/verify-conduit/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/how/SKILL.md`
- [ ] Load the Conduit skills `AGENTS.md` names before editing each PR. Load `conduit-structure`, `conduit-components`, `mattpocock-skills:codebase-design`, `orpc-contract`, `nestjs-best-practices`, `conduit-database` for PR1, PR3, and PR4, `vercel-react-best-practices`, `vercel-composition-patterns`, `next-cache-components-optimizer` for `/canvases` and `/channels/[roomId]`, `next-dev-loop`, and `DESIGN.md`.
- [ ] For every UI task in PR1 through PR5, load both `design-taste-frontend` (specifically `references/app-screens.md`, because canvases, lists, side panels, and dialogs are app screens) and `emil-design-eng` before writing markup or CSS.
- [ ] Confirm these operator gates before the PR that needs them starts.
  - [ ] Package install approval for PR2. Add `@liveblocks/node` to `apps/server`, and `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/yjs`, and `yjs` to `apps/client`.
  - [ ] Liveblocks project creation before PR2. Create a Liveblocks project and set `LIVEBLOCKS_SECRET_KEY` in `apps/server/.env`, `turbo.json`, and Vercel.
  - [ ] Database migration approval before running `pnpm db:migrate-deploy` for `24_canvases` (PR1), `25_canvas_comments` (PR3), and `26_canvas_versions` (PR4), per `conduit-database`.
  - [ ] Live LLM eval approval before running `pnpm --filter server eval:canvas-draft` in PR5.
- [ ] On the operator's go, arm the audit tick as `/loop 1h` with the tick prompt below. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk. Audit the operation against it and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then post a short status message to the operator in chat only when the audit found a tracked change that no earlier status message reported, such as a PR opened, a code-ready head, a round launched or closed, a verdict, a merge, a stuck agent and the action taken, a blocker added or cleared, or a decision only the operator can make. Name every such change and nothing else. Do not repeat a table, the merged list, or an unchanged blocker. If the audit found none, end the turn with no reply text. Either way, log this tick's row in your decision trail. The row names the items reported, or none."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle `autopilot-stack.md` names.
- [ ] Follow this dependency graph. Start dependent work on its parent branch after the parent reaches STACK-READY.
  - [ ] PR1 is first and branches from `staging`.
  - [ ] PR2 after PR1.
  - [ ] PR3 after PR2.
  - [ ] PR4 after PR3.
  - [ ] PR5 after PR4.
- [ ] Hold the file boundaries. Keep each new domain under `packages/contract/src/{contracts,schemas,lib}/`, `apps/server/src/canvases/`, `apps/client/src/services/canvases/`, `apps/client/src/features/canvases/`, and shared editor fixes under `apps/client/src/components/editor/`. Register `canvases` in `featureDeps` and `services` in `apps/client/eslint.config.mjs`.
- [ ] Hold the review gate. PR1, PR2, PR3, PR4, and PR5 all change user interactions. Every PR waits for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`; if `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, per **Opening a PR**. PR1 targets `staging`. PR2 through PR5 target their parent branch. Use the run's built-in PR tool when it has one, else `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>`.
- [ ] State any migration folder added in the first line of the PR body, per `conduit-database`. Update `PRD.md` in the same diff that ships each M4 row. Add new domain terms to `GLOSSARY.md` when introduced.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm --filter @conduit/contract test`, `pnpm --filter server test`, and `pnpm --filter client test` once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] On every UI PR (PR1 through PR5), run `design-taste-frontend` app-screen checks (`node <design-taste-frontend>/scripts/lint.mjs --app` and `node <design-taste-frontend>/scripts/inspect.mjs --app <url>`) until `inspect.mjs --app` reports 0 `FAIL` at 1440, 768, and 390, and inspect every screenshot against `references/app-screens.md`.
- [ ] On every UI PR (PR1 through PR5), audit all interactive states and transitions against `emil-design-eng`'s Animation Decision Framework and Review Checklist, and include the required `| Before | After | Why |` review table in the PR body.
- [ ] Triage every Bugbot and security-reviewer comment per `../references/bugbot-triage.md`.
- [ ] Rebase onto current `staging` (for PR1) or the parent tip (for PR2 through PR5) through the root only, before the code-ready report and babysit. Keep that merge base in fix rounds.

### Verdict and merge, for every PR

- [ ] A full swarm runs once, at the code-ready head. Another full swarm runs only for new behavior, a redesign, or a large new diff. A rebase, a merge-conflict resolution, or a minor fix gets a single verifier at the new head. Run each full swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. Two or more audit lanes, each with its own focus, that read the diff and the receipts and distrust the PR body. The root audits the receipts in the STACK-READY report before the verdict.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner, including a defect that a lane filed as a note. A new head gets a fresh verdict, except for results that stay valid under the patch-id rule in `playbooks/shipping.md`.
- [ ] Append each verified PR to the base-branch stack in dependency order, with its base set to its parent branch (`gh pr edit <pr> --base <parent-branch>`). Carry forward unchanged lane verdicts only under the patch-id rule in `playbooks/shipping.md`. The operator lands the verified stack bottom-up onto `staging`.

### Boot recipe, for every live lane

Each live lane runs against the PR head in a real Chromium browser driven through `.agents/skills/verify-conduit/SKILL.md` (Conduit's Playwright verification driver; see Appendix D on why this stands in for `control-ui`).

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] Start the NestJS server (`:3333`) and Next.js client (`:3000`) per `verify-conduit`, and wait until both respond healthy.
- [ ] Sign up fresh test accounts with `delivered+<tag>@resend.dev` addresses, mark them verified in the dev database, and record all created test data for the report.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Build canvas persistence, channel tab, sharing, and floating Lexical editor (PR1)

**Depends on.** None.

**Files.**

- [ ] Edit `apps/server/database/schema.prisma` to add `CanvasRole`, `Canvas`, and `CanvasMember`, and generate `apps/server/database/migrations/24_canvases/migration.sql` (including a partial unique index enforcing at most one `isChannelPrimary = true` canvas per `channelId`).
- [ ] Create `packages/contract/src/lib/canvas-policy.ts` and `packages/contract/src/lib/canvas-policy.test.ts`.
- [ ] Create `packages/contract/src/schemas/canvases.ts` and `packages/contract/src/contracts/canvases.ts`, and register `canvases` in `packages/contract/src/contract.ts` and `packages/contract/src/index.ts`.
- [ ] Create `apps/server/src/canvases/` with `domain/canvases.repository.ts`, `domain/canvas-errors.ts`, `application/canvases.service.ts`, `application/canvases.service.test.ts`, `infrastructure/prisma-canvases.repository.ts`, `presentation/canvases.controller.ts`, and `canvases.module.ts`. Register `CanvasesModule` in `apps/server/src/app.module.ts`.
- [ ] Edit `apps/client/src/components/editor/plugins/floating-text-format-plugin.tsx`, `floating-link-editor-plugin.tsx`, `component-picker-menu-plugin.tsx`, `draggable-block-plugin.tsx`, and `plugins/picker/divider-picker-plugin.tsx` to fix the five measured bugs in Appendix A, switch icons to `@tabler/icons-react`, and expose an optional trailing action slot on `FloatingTextFormatToolbarPlugin`.
- [ ] Edit `apps/client/src/components/editor/themes/editor-theme.ts` to fix the `bsolute` typo on line 82 and confirm light and dark checklist styling.
- [ ] Create `apps/client/src/services/canvases/queries.ts` and `apps/client/src/services/canvases/hooks.ts`.
- [ ] Create `apps/client/src/features/canvases/lib/canvas-extension.ts` and `apps/client/src/features/canvases/lib/canvas-extension.test.ts`.
- [ ] Create `apps/client/src/features/canvases/components/canvas-editor.tsx`, `canvas-header.tsx`, `canvas-channel-tab.tsx`, `canvas-list.tsx`, and `canvas-share-dialog.tsx`.
- [ ] Edit `apps/client/src/app/(dashboard)/(workspace)/(home)/channels/[roomId]/page.tsx` to add **Messages** and **Canvas** tabs under `ChannelHeader` with no top border, backed by nuqs `?tab=` state.
- [ ] Create `apps/client/src/app/(dashboard)/(workspace)/(home)/canvases/page.tsx` and `apps/client/src/app/(dashboard)/(workspace)/(home)/canvases/[canvasId]/page.tsx`.
- [ ] Edit `apps/client/src/components/app-shell.tsx` to add a **Canvases** rail link and fix `isRailActive` so `/` does not stay active on `/files` or `/canvases`.
- [ ] Edit `apps/client/eslint.config.mjs` to add `canvases` to `featureDeps` (`['rooms', 'workspace', 'messages']`) and `services`.
- [ ] Edit `PRD.md` to mark M4.1 and M4.4 `Shipped` and M4 `In progress`.

**Build.**

- [ ] Implement `canCanvas` and `checkCanvas` in `canvas-policy.ts` as the single permission table for `view`, `edit`, `comment`, `manageSharing`, and `delete`. A channel canvas inherits its channel's `view` and `post` rules (archived channels become read-only). A standalone canvas grants access strictly to its `CanvasMember` rows (`EDITOR` or `VIEWER`).
- [ ] Implement `canvases.getChannelCanvas`, `canvases.list`, `canvases.get`, `canvases.create`, `canvases.update` (title, `snapshotJson`, `markdown`), `canvases.delete`, `canvases.listMembers`, `canvases.share`, `canvases.updateMemberRole`, and `canvases.removeMember`. Return `NOT_FOUND` for inaccessible canvases so responses never leak existence.
- [ ] Build `createCanvasExtension` in `canvas-extension.ts` on `buildEditorFromExtensions` and `LexicalExtensionEditorComposer` with `RichTextExtension`, `HistoryExtension`, `ListExtension`, `CheckListExtension`, `LinkExtension`, `AutoLinkExtension`, `CodeExtension` (`CodeBlockNode`), `TableExtension`, `HorizontalRuleExtension`, `TabIndentationExtension`, `EmojisExtension`, `MarkdownShortcutsExtension`, and `MentionNode`.
- [ ] Mount `FloatingTextFormatToolbarPlugin`, `FloatingLinkEditorPlugin`, `ComponentPickerMenuPlugin` (`/` command menu with headings H1 to H3, paragraph, bulleted list, numbered list, checklist, quote, code block, divider, table, and columns), `DraggableBlockPlugin`, `MentionsPlugin` (workspace or channel members, no `@channel` or `@here`), `EmojiPickerPlugin`, `CodeBlockPlugin`, and `CodeHighlightPlugin` inside `CanvasEditor`. Render no fixed formatting toolbar.
- [ ] Fix `FloatingTextFormatToolbarPlugin` to pass controlled `value` to `ToggleGroup`, fix `FloatingLinkEditorPlugin` stale `editedLinkUrl` and `'link-input'` blur check, escape regex metacharacters in `ComponentPickerMenuPlugin` and `DraggableBlockPlugin`, and import `INSERT_HORIZONTAL_RULE_COMMAND` from `@lexical/extension` in `DividerPickerPlugin`.
- [ ] Add debounced single-user autosave (`canvases.update`, 1 s debounce + save on blur) in `CanvasEditor` with a subtle header status indicator (`Saved`, `Saving`, or `Read only`).
- [ ] Build the channel **Messages** and **Canvas** tabs using `TabsList variant="line"` with no top border per `DESIGN.md`. Opening **Canvas** on a channel with no primary canvas shows a centred `Empty` with a **Create canvas** button.
- [ ] Build `/canvases` as a full-width `Table` per `DESIGN.md` showing every canvas the member can read (channel and standalone), with a **New canvas** button and a search icon beside the scope filter (`All`, `Channel`, `Shared with me`).
- [ ] Build `CanvasShareDialog` with shadcn `Dialog`, `Combobox`, `Select` (`Can edit` or `Can view`), and member removal. Mentioning a workspace member who cannot access a standalone canvas shows a one-click inline prompt to share the canvas with them.
- [ ] Apply `design-taste-frontend` (`references/app-screens.md`) and `emil-design-eng` to all PR1 UI. Keep surfaces flat with 1 px borders, reserve colour for active state and the one primary action (`Create canvas` or `New canvas`), and align `/canvases` on one left edge with no zebra striping. Keep keyboard-initiated `/` (`ComponentPickerMenuPlugin`) and `@` (`MentionsPlugin`) menus instant with zero open or close animation. Animate `FloatingTextFormatToolbarPlugin` on mouse selection over 150 ms with `cubic-bezier(0.23, 1, 0.32, 1)` from `scale(0.97)` and `opacity: 0` (never `scale(0)` and never `transition: all`), give pressable buttons `scale(0.97)` on `:active`, use `transform-origin: var(--transform-origin)` on popovers, gate hover motion with `@media (hover: hover) and (pointer: fine)`, and honour `prefers-reduced-motion`.

**You see.**

- [ ] Opening `#general` shows **Messages** and **Canvas** tabs directly under the header with no line between header and tabs. Clicking **Canvas** shows an empty state with **Create canvas**, and clicking it opens a blank canvas with no fixed toolbar.
- [ ] Selecting text inside the canvas opens the floating formatting toolbar with active bold, italic, code, and link states synced to the selection. Typing `/` opens the slash command menu, and selecting **Check List** inserts interactive checkboxes that toggle on click and Space.
- [ ] Typing `@` opens the fixed-height mention menu, inserts a `text-link` mention pill, and typing `:` inserts a Twemoji emoji.
- [ ] Creating a standalone canvas from `/canvases` and sharing it as `Can view` with Member B lets Member B read it in read-only mode, while Member C gets `NOT_FOUND`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `packages/contract/src/lib/canvas-policy.test.ts` covers public channel, private channel, archived channel, standalone editor, standalone viewer, non-member, and workspace admin rules. Run `pnpm --filter @conduit/contract test`.
- [ ] `apps/server/src/canvases/application/canvases.service.test.ts` (with `TEST_DATABASE_URL`) covers channel primary uniqueness, private-channel isolation (`NOT_FOUND`), archived read-only enforcement, standalone sharing role changes, last-editor guard, and cascade cleanup. Run `pnpm --filter server test`.
- [ ] `apps/client/src/features/canvases/lib/canvas-extension.test.ts` covers regex escaping in `/` queries (including `/[`), checklist markdown round-trip, and mention serialization. Run `pnpm --filter client test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `claudeAgent/claude-opus-5-5-medium` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run channel messaging and Composer rich-text formatting in `#all-*` at `staging` and PR1 head, then verify the new **Canvas** tab opens and saves content on PR1 head (`staging` has no Canvas tab, record that). Save `pr1-lane1-regression.png`. Pass when messaging and Composer work unchanged and the new Canvas tab creates and persists a document across reload.
- [ ] Lane 2. Selection floating toolbar. Type a paragraph, select a word, toggle bold, italic, code, and link via `FloatingTextFormatToolbarPlugin`, deselect, and reselect to confirm controlled active toggle state. Save `pr1-lane2-floating-toolbar.png`. Pass when the toolbar shows only on selection, reflects active formats accurately, and edits the link via `FloatingLinkEditorPlugin`.
- [ ] Lane 3. Slash command menu and special characters. Type `/`, filter by `check`, insert a checklist, then type `/[` and `/table` to insert a table and divider. Save `pr1-lane3-slash-menu.png`. Pass when `/[` does not throw, every block inserts cleanly, and checkboxes toggle via click and keyboard.
- [ ] Lane 4. Mentions and Twemoji. Type `@` to insert a workspace member mention and `:rocket:` to insert an emoji, reload the page, and verify both persist. Save `pr1-lane4-mentions-emoji.png`. Pass when the mention renders in `text-link` and the emoji renders via Twemoji.
- [ ] Lane 5. Private channel isolation. Member A creates a canvas in a private channel; Member B (outside the channel) navigates directly to that canvas URL and checks `/canvases`. Save `pr1-lane5-private-channel.png`. Pass when Member B sees `NOT_FOUND` and the canvas is absent from `/canvases`.
- [ ] Lane 6. Standalone canvas sharing and viewer read-only mode. Member A creates a standalone canvas, shares it with Member B as `Can view`, and Member B opens it. Save `pr1-lane6-standalone-viewer.png`. Pass when Member B reads the content, sees the `Read only` indicator, and cannot edit or open the floating toolbar.
- [ ] Lane 7. Archived channel read-only mode. Archive a channel with an existing canvas and open its **Canvas** tab. Save `pr1-lane7-archived-readonly.png`. Pass when the canvas renders read-only and rejects edits.
- [ ] Lane 8. Mobile 360 px viewport. Open the channel **Canvas** tab, `/canvases`, and `CanvasShareDialog` at 360 px width. Save `pr1-lane8-mobile-360.png`. Pass when there is zero horizontal overflow and the floating toolbar stays inside the viewport.
- [ ] Lane 9. Dark and light themes. Switch themes on both `/canvases` and an active canvas with headings, checklist, code block, and table. Save `pr1-lane9-themes.png`. Pass when contrast meets WCAG 2.2 AA and checklist checkboxes remain clearly visible in both themes.
- [ ] Lane 10. Keyboard-only navigation. Navigate from channel header to **Canvas** tab, create a canvas, open `/`, insert a checklist, toggle an item, and open `CanvasShareDialog` with keyboard only. Save `pr1-lane10-keyboard.png`. Pass when every control is reachable and Escape restores focus cleanly.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Channel page initial route hydration time and client bundle JS size for `/channels/[roomId]` (both `staging` and PR1 head), plus canvas tab mount time from click to editable focus on PR1 head.
- [ ] Probe. Build `apps/client` at `staging` and PR1 head, compare `/channels/[roomId]` first-load JS from Next build output, and run 10 interleaved Playwright loads of `/channels/[roomId]` measuring `navigationStart` to composer ready, plus 10 clicks on the **Canvas** tab measuring click to editable `contenteditable`.
- [ ] Baseline. Record `staging` `/channels/[roomId]` first-load JS (KB) and median and p95 channel-ready time (ms) first.
- [ ] Rule. Fail if PR1 increases `/channels/[roomId]` initial JS by more than 15 KB (canvas editor must be dynamically imported when the **Canvas** tab is active), if channel-ready p95 regresses by more than 10 percent, or if Canvas tab mount p95 exceeds 400 ms.

**Review gate.** The operator reviews before merge.

- [ ] Run `design-taste-frontend` `lint.mjs --app` and `inspect.mjs --app` with 0 `FAIL` on the channel Canvas tab and `/canvases`, and add the `emil-design-eng` `| Before | After | Why |` table to the PR1 body.
- [ ] Copy lane 1, lane 2, lane 3, lane 8, and lane 9 screenshots into `artifacts/m4/pr1-review-<slug>.png`.
- [ ] Record a 30 to 60 second video showing creating a channel canvas, formatting via the floating toolbar and `/` menu, toggling checklists, and sharing a standalone canvas. Save it as `artifacts/m4/pr1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's review.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current `staging` after the verdict, patch-id unchanged.
- [ ] Root marks PR1 ready at the bottom of the stack; the operator lands it onto `staging`.

## Add multi-user realtime editing and live cursors with Liveblocks (PR2)

**Depends on.** PR1.

**Files.**

- [ ] Edit `apps/server/package.json` to add `@liveblocks/node`, and `apps/client/package.json` to add `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/yjs`, and `yjs`.
- [ ] Edit `apps/server/.env.example` and `turbo.json` to declare `LIVEBLOCKS_SECRET_KEY`.
- [ ] Edit `packages/contract/src/schemas/canvases.ts` and `packages/contract/src/contracts/canvases.ts` to add `canvases.liveblocksAuth`, `canvases.claimBootstrap`, and `canvases.saveSnapshot`.
- [ ] Create `apps/server/src/canvases/domain/liveblocks.port.ts`, `apps/server/src/canvases/infrastructure/liveblocks.gateway.ts`, and `apps/server/src/canvases/testing/fake-liveblocks.gateway.ts`.
- [ ] Edit `apps/server/src/canvases/application/canvases.service.ts`, `canvases.service.test.ts`, `presentation/canvases.controller.ts`, and `canvases.module.ts` to wire room authorization, bootstrap claim, snapshot persistence, and Liveblocks room deletion on canvas delete.
- [ ] Edit `apps/server/database/schema.prisma` only if PR1 did not land `seededAt DateTime?` and `contentHash String?` on `Canvas` in `24_canvases`. Confirm both columns exist in PR1 before branching so PR2 adds no migration.
- [ ] Create `apps/client/src/features/canvases/lib/liveblocks-yjs-adapter.ts` and `apps/client/src/features/canvases/lib/liveblocks-yjs-adapter.test.ts`.
- [ ] Create `apps/client/src/features/canvases/components/canvas-collab-provider.tsx` and `apps/client/src/features/canvases/components/canvas-presence-avatars.tsx`.
- [ ] Edit `apps/client/src/features/canvases/components/canvas-editor.tsx` and `canvas-header.tsx` to wrap the editor in `LexicalCollaboration` + `CollaborationPlugin` backed by `getYjsProviderForRoom(room)` and render active collaborator avatars and colored remote cursors.
- [ ] Edit `apps/client/src/components/editor/themes/editor-theme.ts` or `packages/ui/src/styles/globals.css` to style Lexical remote cursor carets and name flags cleanly in light and dark themes.
- [ ] Edit `PRD.md` to mark M4.2 `Shipped`.

**Build.**

- [ ] Implement `canvases.liveblocksAuth({ canvasId })` behind `authorized`, `arcjet.read`, and `workspaceMember`. Check `canCanvas('view')` and `canCanvas('edit')` against Postgres, compute a deterministic cursor color from `user.id`, and call `liveblocks.prepareSession(user.id, { userInfo: { name, image, color } })` allowing only `canvas:<organizationId>:<canvasId>` with `['room:read', 'room:presence:write', 'room:write']` for editors and `['room:read', 'room:presence:write']` for viewers. Never grant wildcard room patterns.
- [ ] Implement `canvases.claimBootstrap({ canvasId })` with an atomic Postgres conditional update (`WHERE id = $1 AND "seededAt" IS NULL`) so at most one client seeds an empty Yjs document from `Canvas.snapshotJson` or `Canvas.initialMarkdown`, preventing duplicate inserts when two members open a new canvas simultaneously.
- [ ] Implement `liveblocks-yjs-adapter.ts` wrapping `getYjsProviderForRoom(room)` from `@liveblocks/yjs` into the `@lexical/yjs` `Provider` interface expected by `@lexical/react/LexicalCollaborationPlugin` (`@lexical/yjs@0.49.0`), preserving Yjs `awareness`, `sync` events, and clean unmount disposal without using `@liveblocks/react-lexical`.
- [ ] Remove local `HistoryExtension` when `CollaborationPlugin` is mounted, because `@lexical/yjs` binds `Y.UndoManager` per user so `Ctrl+Z` undoes only the caller's own edits without reverting another collaborator's typing.
- [ ] Render `CanvasPresenceAvatars` in `CanvasHeader` using Liveblocks `useOthers()` and Conduit `UserAvatar`, showing active viewers and editors with matching cursor color rings.
- [ ] Replace PR1's per-keystroke `canvases.update` with debounced `canvases.saveSnapshot` (30 s idle after local edits, plus page-hide `keepalive` flush, skipped when `contentHash` matches) so Postgres always holds a fresh `snapshotJson` and `markdown` mirror without saturating the API.
- [ ] Degrade gracefully when `LIVEBLOCKS_SECRET_KEY` is unset or Liveblocks disconnects. Show a non-blocking banner (`Reconnecting to live collaboration...`) and disable editing until reconnected so no edits vanish silently.
- [ ] Apply `design-taste-frontend` (`references/app-screens.md`) and `emil-design-eng` to presence and cursor UI. Assign deterministic collaborator cursor hues spaced cleanly apart with quiet chrome in `CanvasHeader`. Position remote cursor carets with GPU-composited `transform` only (no layout-triggering transitions), and animate collaborator avatar entries and the reconnecting banner with 180 ms `ease-out` from `scale(0.95)` and `opacity: 0` (opacity only under `prefers-reduced-motion`).

**You see.**

- [ ] Member A and Member B open the same canvas in two browsers. Both see each other's avatar in the canvas header and a labeled colored cursor moving live as the other types.
- [ ] Both type in different paragraphs and inside the same sentence simultaneously. Neither loses characters, and both browsers converge to identical text.
- [ ] Member A presses `Ctrl+Z`, which undoes only Member A's last edit and leaves Member B's edit intact.
- [ ] Member C (with `Can view` access) sees live edits and cursors in real time, and Liveblocks rejects any write attempt at the token boundary.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `canvases.service.test.ts` (with `FakeLiveblocksGateway` and `TEST_DATABASE_URL`) covers `liveblocksAuth` granting `room:write` to editors, `room:read` only to viewers and archived channels, `NOT_FOUND` to non-members and deactivated members, single-winner `claimBootstrap` under concurrent calls, and `deleteRoom` on canvas delete. Run `pnpm --filter server test`.
- [ ] `liveblocks-yjs-adapter.test.ts` covers `sync` event forwarding, `awareness` passthrough, and idempotent `connect` and `disconnect`. Run `pnpm --filter client test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `claudeAgent/claude-opus-5-5-medium` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Verify PR1 single-user canvas creation, floating toolbar, `/` menu, checklists, and channel messaging still pass at PR2 head (`staging` has no collaborative canvas, record that and gate concurrent two-browser edit convergence). Save `pr2-lane1-regression.png`. Pass when all PR1 flows work and two browsers converge on identical content after concurrent edits.
- [ ] Lane 2. Concurrent typing in the same paragraph. Two Chromium contexts type alternating words simultaneously into the same line for 10 seconds, then wait 2 seconds. Save `pr2-lane2-same-paragraph.png`. Pass when zero typed characters are dropped and both DOMs have identical text.
- [ ] Lane 3. Live colored cursors and name flags. Member A places caret and selects a range while Member B watches the canvas. Save `pr2-lane3-cursors.png`. Pass when Member B sees Member A's labeled cursor caret and selection highlight in Member A's assigned color.
- [ ] Lane 4. Collaborator avatar stack. Member A, Member B, and Member C open the canvas, then Member C closes their tab. Save `pr2-lane4-presence-avatars.png`. Pass when the header avatar stack shows 2 others, then drops to 1 within 5 seconds of Member C leaving.
- [ ] Lane 5. Per-user collaborative undo. Member A types `alpha`, Member B types `beta`, then Member A presses `Ctrl+Z`. Save `pr2-lane5-collab-undo.png`. Pass when `alpha` is undone and `beta` remains on both clients.
- [ ] Lane 6. Viewer read-only enforcement. Member C with `Can view` opens the canvas while Member A edits. Save `pr2-lane6-viewer-sync.png`. Pass when Member C receives live updates, sees Member A's cursor, and cannot type or mutate the room.
- [ ] Lane 7. Simultaneous first-open bootstrap race. Create a canvas with `initialMarkdown`, then open it from two browser contexts at the exact same moment. Save `pr2-lane7-bootstrap-race.png`. Pass when the initial content appears once, not duplicated.
- [ ] Lane 8. Offline reconnect merge. Disconnect browser B's network via Playwright `setOffline(true)`, type in browser A and browser B, then reconnect browser B. Save `pr2-lane8-offline-merge.png`. Pass when the reconnecting banner clears and both browsers merge both edits cleanly.
- [ ] Lane 9. Dark mode cursor readability and 360 px mobile layout. Run two-user editing with dark theme on desktop and 360 px mobile viewport. Save `pr2-lane9-dark-mobile.png`. Pass when cursor name labels remain legible in dark mode and header avatars do not overflow at 360 px.
- [ ] Lane 10. Reload persistence after snapshot sync. Edit across two browsers, wait for snapshot save (or trigger page blur), reload both browsers, and verify Postgres holds the latest content. Save `pr2-lane10-reload-persistence.png`. Pass when both browsers show the full merged content after reload.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. End-to-end keystroke propagation latency (p50 and p95, ms) from typing in browser A to DOM render in browser B over Liveblocks, plus `canvases.liveblocksAuth` server p95 latency (ms).
- [ ] Probe. Run a Playwright script sending 50 timestamped keystrokes from context A and measuring arrival in context B (PR2 head; `staging` has no canvas collaboration, so also measure `staging` message delivery via `measure-delivery.ts` interleaved to confirm zero regression on chat realtime). Time 50 `canvases.liveblocksAuth` calls.
- [ ] Baseline. Record `staging` message delivery p95 (must stay under 200 ms) first.
- [ ] Rule. Fail if collaborative keystroke propagation p95 exceeds 200 ms on a normal connection, if `canvases.liveblocksAuth` p95 exceeds 300 ms, or if `staging` chat delivery regresses past 200 ms.

**Review gate.** The operator reviews before merge.

- [ ] Run `design-taste-frontend` `lint.mjs --app` and `inspect.mjs --app` with 0 `FAIL` on an active collaborative canvas, and add the `emil-design-eng` `| Before | After | Why |` table to the PR2 body.
- [ ] Copy lane 2, lane 3, lane 5, and lane 9 screenshots into `artifacts/m4/pr2-review-<slug>.png`.
- [ ] Record a 30 to 60 second split-screen video of two users typing simultaneously with live cursors, per-user undo, and offline reconnect merge. Save it as `artifacts/m4/pr2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's review.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Appended on PR1's branch by root, patch-id unchanged.
- [ ] Operator lands PR2 after PR1.

## Add inline text comments and embedded messages (PR3)

**Depends on.** PR2.

**Files.**

- [ ] Edit `apps/server/database/schema.prisma` to add `CanvasCommentThread` and `CanvasComment`, and generate `apps/server/database/migrations/25_canvas_comments/migration.sql`.
- [ ] Edit `packages/contract/src/schemas/canvases.ts` and `packages/contract/src/contracts/canvases.ts` to add `canvases.listComments`, `canvases.createCommentThread`, `canvases.replyComment`, `canvases.editComment`, `canvases.deleteComment`, `canvases.resolveCommentThread`, and `canvases.embeddedMessages`.
- [ ] Create `apps/server/src/canvases/domain/canvas-comments.repository.ts`, `apps/server/src/canvases/infrastructure/prisma-canvas-comments.repository.ts`, `apps/server/src/canvases/application/canvas-comments.service.ts`, and `apps/server/src/canvases/application/canvas-comments.service.test.ts`.
- [ ] Edit `apps/server/src/canvases/application/canvases.service.ts` and `presentation/canvases.controller.ts` to expose comment procedures and `canvases.embeddedMessages` (hydrating requested `messageId[]` strictly through `RoomsRepository.accessibleRoomIds(viewer)`).
- [ ] Create `apps/client/src/components/editor/nodes/message-embed-node.tsx` (`DecoratorBlockNode` storing `{ messageId }` only) and `apps/client/src/components/editor/plugins/picker/message-embed-picker-plugin.tsx` (`/message`).
- [ ] Create `apps/client/src/features/canvases/components/canvas-comments-plugin.tsx`, `canvas-comment-popover.tsx`, `canvas-comments-panel.tsx`, `canvas-message-embed.tsx`, and `canvas-message-picker-dialog.tsx`.
- [ ] Edit `apps/client/src/features/canvases/lib/canvas-extension.ts` to register `MarkNode` (from `@lexical/mark`) and `MessageEmbedNode`.
- [ ] Edit `apps/client/src/features/canvases/components/canvas-editor.tsx` and `canvas-header.tsx` to add the **Comment** button in `FloatingTextFormatToolbarPlugin`, `Ctrl+Alt+M` shortcut, **Comments** toggle button with open-thread count badge in `CanvasHeader`, Liveblocks `broadcastEvent({ type: 'COMMENTS_CHANGED' })` cache invalidation, and paste-URL detection for Conduit message links.
- [ ] Edit `apps/client/src/features/messages/components/message/message-actions.tsx` to add **Copy link** to the message actions menu.
- [ ] Edit `apps/client/src/components/editor/themes/editor-theme.ts` to add `mark` and `markOverlap` highlight styles for light and dark themes.
- [ ] Edit `PRD.md` to mark M4.3 and M4.5 `Shipped`.

**Build.**

- [ ] Store comment threads and replies in Postgres and anchor highlighted text ranges with `@lexical/mark` (`MarkNode`), whose `ids: string[]` sync automatically across live collaborators via `@lexical/yjs` and Liveblocks.
- [ ] On **Comment** click in `FloatingTextFormatToolbarPlugin` (or `Ctrl+Alt+M`), open `CanvasCommentPopover` anchored to the selection. Submitting calls `canvases.createCommentThread({ canvasId, quote, body })`, wraps the range with `$wrapSelectionInMarkNode(selection, false, thread.id)`, and broadcasts `COMMENTS_CHANGED` on the Liveblocks room so every open collaborator's `canvasCommentsQuery` refreshes immediately.
- [ ] Render `CanvasCommentsPanel` in `SidePanel` at `xl` and above, and in a right `Sheet` below `xl`, per Conduit's side-panel pattern. Support **Open** and **Resolved** filters, inline replies, edit and delete for own comments, and **Resolve** or **Reopen** (resolving unwraps the `MarkNode` if still present while preserving the thread's saved `quote` under **Resolved**).
- [ ] Allow `VIEWER` members to read comments and restrict creating or resolving comments to members who pass `canCanvas('comment')` (editors on non-archived canvases).
- [ ] Implement `MessageEmbedNode` storing only `messageId` in Lexical and Yjs. Never write message body text into Yjs. Render `CanvasMessageEmbed` via `canvases.embeddedMessages` using Conduit's `MessageExcerpt` with `MentionNames` context, channel name header, and **Jump to message** link.
- [ ] When a viewer lacks access to the embedded message's room or the message is deleted, return `status: 'inaccessible'` or `'deleted'` from `canvases.embeddedMessages` and render a neutral placeholder card (`Message from a channel you cannot access` or `This message was deleted`) without leaking author or text.
- [ ] Support embedding a message in two ways. Typing `/message` opens `CanvasMessagePickerDialog` (searching accessible messages via `search.query` or accepting a pasted link). Pasting a Conduit message URL directly into the canvas inserts a `MessageEmbedNode`.
- [ ] Apply `design-taste-frontend` (`references/app-screens.md`) and `emil-design-eng` to comment and embed UI. Keep `MessageEmbedNode` cards flat with 1 px borders, subtle `MarkNode` highlight tints that intensify only on the active thread, and honest unavailable or deleted placeholders with no `panel-void` gaps. Open `CanvasCommentPopover` with zero animation when triggered via `Ctrl+Alt+M` and with a 150 ms `ease-out` origin-aware transition when clicked from the floating toolbar. Keep `CanvasCommentsPanel` instant in `SidePanel` at `xl` and above, keep `Sheet` motion below `xl`, and render incoming comment replies with no entrance animation.

**You see.**

- [ ] Member A selects a phrase, clicks **Comment** in the floating toolbar, and posts a comment. The phrase highlights on both Member A's and Member B's screens immediately, and Member B replies in the Comments panel and resolves the thread.
- [ ] Member A clicks **Copy link** on a message in `#general` and pastes it into the canvas (or uses `/message`). The message renders inline as a bordered `MessageExcerpt` card with author, formatted Markdown, and **Jump to message**.
- [ ] Member A embeds a message from `#private-ops` into a standalone canvas shared with Member B (who is not in `#private-ops`). Member A sees the full message card; Member B sees `Message from a channel you cannot access`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `canvas-comments.service.test.ts` covers creating a thread, replying, editing or deleting another user's comment (`FORBIDDEN`), resolving and reopening, viewer refusal, and archived channel refusal. Run `pnpm --filter server test`.
- [ ] `canvases.service.test.ts` adds tests for `canvases.embeddedMessages` proving a private-channel message returns `inaccessible` to a non-member, a DM message returns `inaccessible` to a third user, and a deleted message returns `deleted`. Run `pnpm --filter server test`.
- [ ] Client unit test covers Conduit message URL parsing (`/channels/:roomId?message=:id`, `/dms/:roomId?message=:id`, thread reply URLs, and non-Conduit URLs). Run `pnpm --filter client test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `claudeAgent/claude-opus-5-5-medium` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Verify PR2 concurrent editing and cursors still converge cleanly at PR3 head while a `MarkNode` comment and a `MessageEmbedNode` exist in the same document (`staging` has no canvas comments or embeds, record that and gate live convergence plus both new features). Save `pr3-lane1-regression.png`. Pass when edits, marks, and embeds sync identically across two browsers.
- [ ] Lane 2. Create and sync an inline comment. Member A selects text, clicks **Comment** in the floating toolbar, and submits. Save `pr3-lane2-create-comment.png`. Pass when the highlight appears on both browsers and the thread opens in `CanvasCommentsPanel`.
- [ ] Lane 3. Reply, resolve, and reopen a comment thread. Member B clicks the highlighted text, posts a reply, resolves the thread, switches filter to **Resolved**, and reopens it. Save `pr3-lane3-resolve-reopen.png`. Pass when the highlight clears on resolve, the quote stays visible in **Resolved**, and replies sync live to Member A.
- [ ] Lane 4. Orphaned comment after text deletion. Member A comments on a sentence, then deletes that entire sentence from the canvas. Save `pr3-lane4-orphaned-comment.png`. Pass when no error occurs and the thread remains readable in `CanvasCommentsPanel` with its saved `quote`.
- [ ] Lane 5. Embed a message via `/message`. Type `/message`, pick a message from `#general`, and click **Jump to message** on the embedded card. Save `pr3-lane5-slash-embed.png`. Pass when the card renders `MessageExcerpt` with mentions and Twemoji, and **Jump to message** opens `#general` scrolled to that message.
- [ ] Lane 6. Embed a message via Copy link and paste. Click **Copy link** in `MessageActions` on a message, paste into a canvas, and confirm both collaborators see the card. Save `pr3-lane6-paste-embed.png`. Pass when pasting converts into `MessageEmbedNode` and syncs live to Browser B.
- [ ] Lane 7. Cross-channel embed security check. Member A embeds a message from a private channel into a standalone canvas shared with Member B (non-member). Save `pr3-lane7-embed-security.png`. Pass when Member B sees `Message from a channel you cannot access` and network payload contains zero private message text.
- [ ] Lane 8. Deleted message embed. Delete the source message after embedding it in a canvas and reload. Save `pr3-lane8-deleted-embed.png`. Pass when the embed shows `This message was deleted`.
- [ ] Lane 9. Mobile 360 px and dark theme. Open `CanvasCommentPopover`, `CanvasCommentsPanel` (`Sheet`), and an embedded message card at 360 px and in dark mode. Save `pr3-lane9-mobile-dark.png`. Pass when highlight contrast is legible and the sheet closes cleanly on Escape.
- [ ] Lane 10. Keyboard-only commenting and embed deletion. Select text, trigger `Ctrl+Alt+M`, submit a comment, tab through the comments panel, and remove an embedded message block with Backspace. Save `pr3-lane10-keyboard.png`. Pass when all comment and embed flows work without a mouse.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `canvases.embeddedMessages` batch hydration p95 latency for 20 embedded messages and `canvases.listComments` p95 latency for 50 threads on PR3 head, plus collaborative keystroke propagation p95 with 20 active `MarkNode` highlights compared to PR2.
- [ ] Probe. Run an interleaved Playwright and API timing script on PR2 head and PR3 head with a canvas holding 20 `MarkNode` threads and 20 `MessageEmbedNode` blocks (50 keystrokes and 50 API calls).
- [ ] Baseline. Record PR2 keystroke propagation p95 first.
- [ ] Rule. Fail if PR3 keystroke propagation p95 exceeds 200 ms or regresses by more than 20 percent over PR2, or if `embeddedMessages` or `listComments` server p95 exceeds 250 ms.

**Review gate.** The operator reviews before merge.

- [ ] Run `design-taste-frontend` `lint.mjs --app` and `inspect.mjs --app` with 0 `FAIL` on `CanvasCommentsPanel` and embedded message cards, and add the `emil-design-eng` `| Before | After | Why |` table to the PR3 body.
- [ ] Copy lane 2, lane 5, lane 7, and lane 9 screenshots into `artifacts/m4/pr3-review-<slug>.png`.
- [ ] Record a 30 to 60 second video showing selecting text to comment, replying and resolving live across two browsers, embedding a message via `/message` and paste, and showing the private-channel placeholder for an unauthorized viewer. Save it as `artifacts/m4/pr3-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's review.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Appended on PR2's branch by root, patch-id unchanged.
- [ ] Operator lands PR3 after PR2.

## Add Postgres-backed version history with preview and live restore (PR4)

**Depends on.** PR3.

**Files.**

- [ ] Edit `apps/server/database/schema.prisma` to add `CanvasVersionTrigger` (`AUTO | MANUAL | RESTORE | AI_DRAFT`) and `CanvasVersion`, and generate `apps/server/database/migrations/26_canvas_versions/migration.sql`.
- [ ] Edit `packages/contract/src/schemas/canvases.ts` and `packages/contract/src/contracts/canvases.ts` to add `canvases.listVersions`, `canvases.getVersion`, `canvases.createVersion`, and `canvases.restoreVersion`.
- [ ] Create `apps/server/src/canvases/domain/canvas-versions.repository.ts`, `apps/server/src/canvases/infrastructure/prisma-canvas-versions.repository.ts`, `apps/server/src/canvases/application/canvas-versions.service.ts`, and `apps/server/src/canvases/application/canvas-versions.service.test.ts`.
- [ ] Edit `apps/server/src/canvases/application/canvases.service.ts` and `presentation/canvases.controller.ts` so `saveSnapshot` creates an `AUTO` version when content changed (`contentHash` differs) and at least 5 minutes have elapsed since the latest version, and `canvases.create` records Version 1 when initial content is non-empty.
- [ ] Create `apps/client/src/features/canvases/components/canvas-history-panel.tsx`, `canvas-history-preview.tsx`, and `canvas-save-version-dialog.tsx`.
- [ ] Edit `apps/client/src/features/canvases/components/canvas-header.tsx` and `canvas-editor.tsx` to add the **History** button, live restore callback (applying restored Lexical JSON inside one `editor.update()` so Yjs syncs it to every connected client), and `VERSIONS_CHANGED` Liveblocks broadcast.
- [ ] Edit `PRD.md` to mark M4.6 `Shipped`.

**Build.**

- [ ] Store unlimited version history in Postgres (`CanvasVersion`), independent of Liveblocks Free plan's 24-hour retention cap. Each version stores `{ id, canvasId, organizationId, authorId?, label?, trigger, contentHash, snapshotJson, markdown, createdAt }`, indexed on `(canvasId, createdAt desc, id desc)`.
- [ ] Deduplicate `AUTO` versions by SHA-256 `contentHash` and enforce a 5-minute minimum interval between `AUTO` rows so idle or noisy editing never bloats Postgres. Manual checkpoints (`canvases.createVersion` with optional label) bypass the interval.
- [ ] Render `CanvasHistoryPreview` using the same `createCanvasExtension` in `editable: false` mode with **no** `CollaborationPlugin`, so browsing older versions renders headings, checklists, mentions, Twemoji, and `MessageEmbedNode` cards accurately without touching the live Yjs room.
- [ ] Implement `canvases.restoreVersion({ canvasId, versionId, currentSnapshotJson, currentMarkdown })`. In one transaction, record a pre-restore safety snapshot (`trigger: 'RESTORE'`, label `"Before restoring version"`) if the current state differs from the latest version, update `Canvas.snapshotJson` and `Canvas.markdown` to the target version, and record the new restored version row. On the client, replace the live Lexical root inside one `editor.update()` using `$parseEditorState` so Liveblocks Yjs broadcasts the restored document cleanly to all open editors.
- [ ] Guard **Restore this version** behind an `AlertDialog` and hide restore and save-version actions from `VIEWER` members and archived channels.
- [ ] Apply `design-taste-frontend` (`references/app-screens.md`) and `emil-design-eng` to version history UI. Align the version list on one left edge with `tabular-nums` timestamps, mark the active version with a neutral pill in light mode and brightness in dark mode, and eliminate vertical gaps in the split preview. Swap `CanvasHistoryPreview` instantaneously on version selection so arrow-key stepping feels immediate, and keep `CanvasSaveVersionDialog` and the restore `AlertDialog` centered (`transform-origin: center`) with 200 ms `ease-out` from `scale(0.95)`.

**You see.**

- [ ] Member A edits a canvas, clicks **Save version** labelled `v1 spec`, makes more edits, and opens **History**.
- [ ] Selecting `v1 spec` shows a full read-only preview including checklists and embedded messages. Clicking **Restore this version** updates both Member A's and Member B's open browsers immediately, and **History** preserves a pre-restore snapshot so nothing was lost.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `canvas-versions.service.test.ts` (with `TEST_DATABASE_URL`) covers `AUTO` deduplication on identical `contentHash`, 5-minute throttle window, `MANUAL` checkpoint bypass, `restoreVersion` creating a pre-restore safety snapshot before updating `Canvas`, cursor pagination on equal timestamps, and `VIEWER` or non-member refusals. Run `pnpm --filter server test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `claudeAgent/claude-opus-5-5-medium` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Verify PR3 concurrent editing, comments, and message embeds still pass at PR4 head (`staging` has no version history, record that and gate version save, preview, and live restore). Save `pr4-lane1-regression.png`. Pass when all PR3 flows work and version history lists and previews versions cleanly.
- [ ] Lane 2. Save named version and browse preview. Save `Draft 1`, edit the canvas to `Draft 2`, open **History**, and click `Draft 1`. Save `pr4-lane2-preview.png`. Pass when the read-only preview shows `Draft 1` while another open browser still sees `Draft 2` untouched.
- [ ] Lane 3. Live restore synced across two browsers. Member A clicks **Restore this version** on `Draft 1` and confirms the `AlertDialog` while Member B has the canvas open. Save `pr4-lane3-live-restore.png`. Pass when both browsers show `Draft 1` within 2 seconds and **History** includes the pre-restore `Draft 2` safety snapshot.
- [ ] Lane 4. Restore back to pre-restore snapshot. Immediately restore the auto-created pre-restore snapshot from Lane 3. Save `pr4-lane4-undo-restore.png`. Pass when both browsers return to `Draft 2` with zero lost data.
- [ ] Lane 5. Preview fidelity with checklists, mentions, and embedded messages. Save a version containing all three, delete them from live canvas, and preview that version. Save `pr4-lane5-rich-preview.png`. Pass when the read-only preview renders the checklist, mention pill, and `MessageEmbedNode` card accurately.
- [ ] Lane 6. Automatic checkpoint deduplication. Trigger two snapshot saves with identical content and verify `listVersions` does not create duplicate rows. Save `pr4-lane6-dedupe.png`. Pass when only one version row exists for the unchanged hash.
- [ ] Lane 7. Viewer access to history. Member C (`Can view`) opens **History** and previews older versions. Save `pr4-lane7-viewer-history.png`. Pass when Member C can inspect versions but **Restore** and **Save version** buttons are absent and API rejects restore with `FORBIDDEN`.
- [ ] Lane 8. Archived channel history. Open **History** on an archived channel's canvas. Save `pr4-lane8-archived-history.png`. Pass when versions are browsable read-only and restore is disabled.
- [ ] Lane 9. Mobile 360 px and dark theme. Open **History**, preview a version, and open the restore confirmation at 360 px and in dark theme. Save `pr4-lane9-mobile-dark.png`. Pass when no layout overflows and text contrast passes WCAG 2.2 AA.
- [ ] Lane 10. Keyboard-only history navigation. Open **History**, step through versions with arrow keys, preview, press Escape to exit preview, and return focus to the editor. Save `pr4-lane10-keyboard.png`. Pass when every action completes by keyboard alone.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `canvases.listVersions` p95 latency on a canvas with 100 versions (must exclude `snapshotJson` from list rows) and `canvases.getVersion` + read-only preview render time (ms).
- [ ] Probe. Seed 100 `CanvasVersion` rows (20 KB JSON each) on a test canvas in dev DB, time 50 `listVersions` calls and 50 `getVersion` calls, and measure 10 Playwright clicks switching between versions in **History**. Also verify PR3 keystroke latency did not regress.
- [ ] Baseline. Record PR3 keystroke propagation p95 first.
- [ ] Rule. Fail if `listVersions` p95 exceeds 150 ms, if version-switch preview render p95 exceeds 300 ms, or if keystroke propagation p95 exceeds 200 ms.

**Review gate.** The operator reviews before merge.

- [ ] Run `design-taste-frontend` `lint.mjs --app` and `inspect.mjs --app` with 0 `FAIL` on `CanvasHistoryPanel` and `CanvasHistoryPreview`, and add the `emil-design-eng` `| Before | After | Why |` table to the PR4 body.
- [ ] Copy lane 2, lane 3, lane 5, and lane 9 screenshots into `artifacts/m4/pr4-review-<slug>.png`.
- [ ] Record a 30 to 60 second video showing saving a named version, previewing an older rich version, restoring it live while a second browser watches, and restoring the safety snapshot. Save it as `artifacts/m4/pr4-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's review.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Appended on PR3's branch by root, patch-id unchanged.
- [ ] Operator lands PR4 after PR3.

## Add AI thread to canvas draft with verified source links (PR5)

**Depends on.** PR4.

**Files.**

- [ ] Edit `packages/contract/src/schemas/canvases.ts` and `packages/contract/src/contracts/canvases.ts` to add `canvases.draftFromThread` (streaming event iterator) and optional `sourceThreadId` and `sourceMessageIds` fields on `canvases.create`.
- [ ] Create `apps/server/src/canvases/domain/canvas-draft-prompt.ts` and `apps/server/src/canvases/domain/canvas-draft-prompt.test.ts`.
- [ ] Create `apps/server/src/canvases/application/canvas-draft.service.ts` and `apps/server/src/canvases/application/canvas-draft.service.test.ts`.
- [ ] Edit `apps/server/src/canvases/presentation/canvases.controller.ts` and `canvases.module.ts` (importing `AiModule`, `MessagesModule`, `RoomsModule`) to expose `canvases.draftFromThread` behind `authorized`, `workspaceMember`, and `arcjet.heavyWriteByWorkspace`, wrapped in `translateStreamErrors`.
- [ ] Create `apps/server/scripts/eval-canvas-draft.ts` and add `eval:canvas-draft` to `apps/server/package.json`.
- [ ] Create `apps/client/src/features/canvases/components/canvas-draft-dialog.tsx`.
- [ ] Edit `apps/client/src/features/threads/components/thread-panel.tsx` and `apps/client/src/features/messages/components/summary/summary-menu.tsx` so `ThreadPanel` owns the header `DropdownMenu` and accepts a menu slot for **Turn into canvas** beside **Summarize this thread** when workspace AI is enabled.
- [ ] Edit `apps/client/src/app/(dashboard)/(workspace)/(home)/channels/[roomId]/page.tsx` and `apps/client/src/app/(dashboard)/(workspace)/(dms)/dms/[roomId]/page.tsx` to pass the **Turn into canvas** menu item into `ThreadLayout`, keeping `featureDeps` in `apps/client/eslint.config.mjs` acyclic.
- [ ] Edit `PRD.md` to mark M4.7 `Shipped` and M4 `Shipped` once the M4 exit check passes.

**Build.**

- [ ] Enforce every PRD AI rule in `CanvasDraftService.draftFromThread({ messageId })`. Call `AiAccessService.assertEnabled(viewer.organizationId)` first. Verify `viewer` can read the thread's room through `RoomsService.find`. Never expose reasoning traces. Stream drafts visible only to the requester until they explicitly click **Create canvas**.
- [ ] Load the thread root and replies through `MessagesRepository.listForSummary` (up to `SUMMARY_MESSAGES_MAX` and `SUMMARY_PROMPT_CHARS_MAX`), escaping untrusted text inside `<message id="m1" ...>` tags with the same prompt-injection guard used in `summary-prompt.ts`.
- [ ] Stream `{ title, sections: [{ heading, markdown, sourceLabels }], actionItems: [{ text, sourceLabel }] }` through `ModelPort.streamObject` (reusing the existing Vercel AI Gateway and OpenRouter model port with zero new AI SDKs).
- [ ] Validate every `sourceLabel` (`m1..mN`) server-side against real thread message IDs, dropping any invented label. Assemble final `markdown` with inline citation links (`/channels/<roomId>?thread=<rootId>&message=<msgId>`) and a **Sources** section linking every message the draft drew from, plus optional embedded message blocks for cited decisions.
- [ ] Render `CanvasDraftDialog` as a `Dialog` per `DESIGN.md`. Show `AILoader` with `shimmer` status text (`Drafting canvas from thread...`) until the first token arrives, stream the formatted draft through `Markdown` (`@/components/markdown`), let the member pick destination (**Channel canvas** if none exists yet, **New channel canvas**, or **Standalone private canvas**), and offer **Create canvas**.
- [ ] When the member clicks **Create canvas**, call `canvases.create` with `{ title, roomId?, initialMarkdown, versionTrigger: 'AI_DRAFT' }` so Postgres creates the canvas and Version 1 (`AI_DRAFT`), and navigate straight to the new canvas where PR2's atomic `claimBootstrap` populates the Liveblocks Yjs room once.
- [ ] Hide **Turn into canvas** completely when the workspace admin has AI turned off.
- [ ] Apply `design-taste-frontend` (`references/app-screens.md`) and `emil-design-eng` to `CanvasDraftDialog`. Lead with the drafted title and sections, keep **Create canvas** as the single primary button, use Conduit trade labels for destination choices, and keep `CanvasDraftDialog` centered (`transform-origin: center`) with 200 ms `ease-out` from `scale(0.95)` (opacity only under `prefers-reduced-motion`). Render streamed Markdown tokens directly with no per-block entrance animations.

**You see.**

- [ ] Member A opens a 10-message thread in `#product`, clicks the thread header menu, and selects **Turn into canvas**.
- [ ] `CanvasDraftDialog` streams a structured title, sections, checklist items, and numbered links to the thread messages. Nobody else sees the draft yet.
- [ ] Member A clicks **Create canvas**. The new canvas opens with the headings, checklists, and links to every source message it drew from, Version 1 labelled `AI draft` in **History**, and Member B can immediately join and co-edit it.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `canvas-draft-prompt.test.ts` proves `<` escaping, prompt-injection framing, `SUMMARY_PROMPT_CHARS_MAX` truncation, and stripping invented `m99` labels while rewriting valid `m1..mN` labels to exact thread message URLs. Run `pnpm --filter server test`.
- [ ] `canvas-draft.service.test.ts` (with fake `ModelPort` and `TEST_DATABASE_URL`) covers `AI_DISABLED` refusal, private-channel `NOT_FOUND` refusal, valid streaming partials and final draft with verified `sourceMessageIds`, and zero DB writes until `canvases.create` is called. Run `pnpm --filter server test`.
- [ ] With operator approval, run `pnpm --filter server eval:canvas-draft` across 5 fixed threads (spec discussion, incident postmortem, meeting notes, short 2-message thread, and prompt-injection thread). Pass when every draft preserves accurate links to source messages and ignores the injection. Record score in the PR body.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `claudeAgent/claude-opus-5-5-medium` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Verify PR1 through PR4 flows and `Summarize this thread` still work at PR5 head (`staging` has no thread-to-canvas draft, record that and gate the full M4 exit check). Save `pr5-lane1-regression.png`. Pass when two members edit the AI-generated canvas concurrently without losing changes and every source link opens its exact thread message.
- [ ] Lane 2. Stream a thread draft in `CanvasDraftDialog`. Open a multi-reply thread and click **Turn into canvas**. Save `pr5-lane2-streaming-dialog.png`. Pass when `AILoader` and shimmer appear before first token, Markdown streams cleanly with no reasoning trace, and nothing appears in `/canvases` before clicking **Create canvas**.
- [ ] Lane 3. Create as a channel canvas. Choose **New channel canvas** and click **Create canvas**. Save `pr5-lane3-channel-canvas.png`. Pass when the canvas opens with headings, checklists, clickable source message links, and Version 1 (`AI_DRAFT`) in **History**.
- [ ] Lane 4. Create as a standalone private canvas. Choose **Standalone private canvas**, click **Create canvas**, and verify Member B cannot read it until explicitly shared. Save `pr5-lane4-standalone-private.png`. Pass when Member B receives `NOT_FOUND` and does not see it on `/canvases`.
- [ ] Lane 5. Source link verification. Click three source links inside the created canvas. Save `pr5-lane5-source-links.png`. Pass when each link navigates to the exact thread panel and highlights the cited message.
- [ ] Lane 6. AI disabled by workspace admin. Turn workspace AI off in settings and open a thread header menu. Save `pr5-lane6-ai-disabled.png`. Pass when **Turn into canvas** is hidden and calling `canvases.draftFromThread` directly returns `AI_DISABLED`.
- [ ] Lane 7. Cancel mid-stream. Close `CanvasDraftDialog` while the draft is still streaming. Save `pr5-lane7-cancel-stream.png`. Pass when no canvas is created and no console errors appear.
- [ ] Lane 8. DM thread to standalone canvas. Run **Turn into canvas** from a DM thread. Save `pr5-lane8-dm-thread.png`. Pass when destination defaults to **Standalone private canvas** (DMs have no channel tab) and source links open the DM thread cleanly.
- [ ] Lane 9. Mobile 360 px and dark theme. Open `CanvasDraftDialog`, stream a draft, and create the canvas at 360 px and in dark mode. Save `pr5-lane9-mobile-dark.png`. Pass when dialog scrolls cleanly with zero horizontal overflow.
- [ ] Lane 10. Keyboard-only end-to-end flow. Open thread menu, select **Turn into canvas**, wait for completion, tab to destination selector and **Create canvas**, and open the first source link by keyboard. Save `pr5-lane10-keyboard.png`. Pass when all controls are reachable and focus lands in the new canvas.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time to first streamed token (TTFT, ms) for `canvases.draftFromThread` on a 30-message thread, and total `canvases.create` + bootstrap open latency (ms).
- [ ] Probe. Run 10 calls to `canvases.draftFromThread` against a seeded 30-message thread interleaved with 10 `summaries.thread` calls on the same thread (measuring both `staging` and PR5 head for `summaries.thread`), and time 10 canvas creations + first loads.
- [ ] Baseline. Record `staging` `summaries.thread` TTFT p50 and p95 first.
- [ ] Rule. Fail if `summaries.thread` regresses by more than 15 percent, if `canvases.draftFromThread` TTFT p95 exceeds 3,500 ms (or exceeds `summaries.thread` p95 by more than 500 ms), or if canvas create plus bootstrap load p95 exceeds 800 ms.

**Review gate.** The operator reviews before merge.

- [ ] Run `design-taste-frontend` `lint.mjs --app` and `inspect.mjs --app` with 0 `FAIL` on `CanvasDraftDialog` and the created canvas, and add the `emil-design-eng` `| Before | After | Why |` table to the PR5 body.
- [ ] Copy lane 1, lane 2, lane 3, and lane 9 screenshots into `artifacts/m4/pr5-review-<slug>.png`.
- [ ] Record a 30 to 60 second video of the full M4 exit check, turning a thread into a canvas, clicking a source link, and two members co-editing the resulting canvas live. Save it as `artifacts/m4/pr5-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's review.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Appended on PR4's branch by root, patch-id unchanged.
- [ ] Operator lands PR5 onto `staging` and verifies the M4 exit check.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Every M4 row in `PRD.md` reads `Shipped` with its PR link, and the M4 milestone row reads `Shipped`.
- [ ] The M4 exit check passes on `staging`. Two members edit the same canvas at once without losing each other's changes, and a thread turned into a canvas keeps a link to every message it drew from.
- [ ] Reply to the operator with the report `autopilot-stack.md` names.

## Appendix A. Prototype evidence

No throwaway browser prototype ran before writing this plan. Every version, file path, and bug below was measured directly from the repository and the npm registry on 2026-11-24.

- **Installed Lexical and React versions (measured).** `apps/client/package.json` runs `lexical@0.49.0`, `@lexical/react@0.49.0`, `@lexical/extension@0.49.0`, `react@19.3.1`, and `next@16.4.6`. `@lexical/react@0.49.0` already bundles `@lexical/yjs@0.49.0`, `@lexical/mark@0.49.0`, and `CollaborationPlugin` (`apps/client/node_modules/@lexical/react/package.json:22,31,414`). `@lexical/list@0.49.0` already exports `CheckListExtension`.
- **Liveblocks package compatibility (measured via `npm view`).** `@liveblocks/react-lexical@3.25.2` and `@liveblocks/node-lexical@3.25.2` pin exact peerDependencies `lexical: "0.35.0"` and `@lexical/react: "0.35.0"`. `@liveblocks/yjs@3.25.2` depends only on `yjs: "^13"`, with zero Lexical peer dependency. `@liveblocks/client@3.25.2`, `@liveblocks/react@3.25.2`, and `@liveblocks/node@3.25.2` support React 19 and have no Lexical dependency.
- **Liveblocks pricing and limits (read from Liveblocks docs on 2026-11-24).** The Free plan includes 500 monthly active rooms, 10 concurrent connections per room, 10 MB per room, 50,000 monthly webhook events (60 s throttle), and 24-hour version history retention. Extended version history requires the $500/month Team plan.
- **Existing editor kit readiness and bugs (read from source on 2026-11-24).**
  - `apps/client/src/components/editor/plugins/floating-text-format-plugin.tsx:200,273` uses uncontrolled `defaultValue` on `ToggleGroup`, so active format states stop updating after mount.
  - `apps/client/src/components/editor/plugins/floating-link-editor-plugin.tsx:77,104` uses stale `linkUrl` before state flushes and checks a missing `'link-input'` class on blur.
  - `apps/client/src/components/editor/plugins/component-picker-menu-plugin.tsx:127` and `draggable-block-plugin.tsx:80` build `new RegExp(queryString, 'i')` without escaping regex metacharacters, so typing `/[` throws.
  - `apps/client/src/components/editor/plugins/picker/divider-picker-plugin.tsx:1` imports `INSERT_HORIZONTAL_RULE_COMMAND` from `@lexical/react/LexicalHorizontalRuleNode` instead of `@lexical/extension`.
  - `apps/client/src/components/editor/themes/editor-theme.ts:82` has a typo (`bsolute`).
  - `apps/client/src/components/editor/extensions/images-extension.tsx:240` calls `document.createElement('img')` at module top level (SSR crash if statically imported; Canvas does not import it).
- **Highest existing Prisma migration (measured).** `23_attach_files` in `apps/server/database/migrations/`. M4 migrations start at `24_canvases`.
- **Unproven until PR2 runs live.** The exact thin `Provider` adapter mapping `getYjsProviderForRoom(room)` from `@liveblocks/yjs@3.25.2` onto `@lexical/yjs@0.49.0` `CollaborationPlugin` (`sync` event timing and `awareness` cursor color rendering in Lexical 0.49) stays unproven until PR2's live lanes execute against a real Liveblocks project.

## Appendix B. Data shapes and API contracts

These shapes govern all five PRs. Prisma maps `roomId` to `@map("channelId")` to match existing `Room` (`@@map("Channel")`) conventions.

| Shape                 | Lives in                            | Holds                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Canvas`              | Prisma model (`24_canvases`)        | `{ id, organizationId, roomId?, isChannelPrimary, title, snapshotJson?, markdown, initialMarkdown?, contentHash?, seededAt?, sourceThreadId?, createdById?, updatedById?, createdAt, updatedAt, deletedAt? }`. Indexed on `(organizationId, roomId)` and `(organizationId, updatedAt desc)`. Partial unique index on `(channelId)` where `isChannelPrimary = true AND deletedAt IS NULL`. |
| `CanvasMember`        | Prisma model (`24_canvases`)        | `{ canvasId, userId, role: CanvasRole ('EDITOR' or 'VIEWER'), addedById?, createdAt }`, primary key on `(canvasId, userId)`. Used for standalone canvases (`roomId IS NULL`).                                                                                                                                                                                                             |
| `CanvasCommentThread` | Prisma model (`25_canvas_comments`) | `{ id, canvasId, organizationId, quote, createdById, resolvedAt?, resolvedById?, createdAt, updatedAt }`. Indexed on `(canvasId, createdAt)`.                                                                                                                                                                                                                                             |
| `CanvasComment`       | Prisma model (`25_canvas_comments`) | `{ id, threadId, authorId, body, mentionedUserIds: String[], editedAt?, deletedAt?, createdAt, updatedAt }`. Indexed on `(threadId, createdAt)`.                                                                                                                                                                                                                                          |
| `CanvasVersion`       | Prisma model (`26_canvas_versions`) | `{ id, canvasId, organizationId, authorId?, label?, trigger: CanvasVersionTrigger ('AUTO' or 'MANUAL' or 'RESTORE' or 'AI_DRAFT'), contentHash, snapshotJson, markdown, createdAt }`. Indexed on `(canvasId, createdAt desc, id desc)`.                                                                                                                                                   |
| `MessageEmbedPayload` | `message-embed-node.tsx`            | `{ messageId: string }` stored in Lexical and Yjs. Never stores message text or author metadata.                                                                                                                                                                                                                                                                                          |
| `LiveblocksRoomId`    | `apps/server/src/canvases/domain/`  | Pure helper `liveblocksRoomId(organizationId, canvasId)` returning `canvas:<organizationId>:<canvasId>`.                                                                                                                                                                                                                                                                                  |

| Procedure                                                                                                                                  | Middleware                                                      | Purpose                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `canvases.list`, `canvases.get`, `canvases.getChannelCanvas`, `canvases.listMembers`                                                       | `authorized`, `arcjet.read`, `workspaceMember`                  | Read accessible canvases and standalone members.                       |
| `canvases.create`, `canvases.update`, `canvases.delete`, `canvases.share`, `canvases.updateMemberRole`, `canvases.removeMember`            | `authorized`, `arcjet.write`, `workspaceMember`                 | Mutate canvas metadata, single-user fallback edits, and sharing.       |
| `canvases.liveblocksAuth`                                                                                                                  | `authorized`, `arcjet.read`, `workspaceMember`                  | Mint per-room Liveblocks session token scoped by Postgres access.      |
| `canvases.claimBootstrap`, `canvases.saveSnapshot`                                                                                         | `authorized`, `arcjet.write`, `workspaceMember`                 | Atomic first-open Yjs seed claim and debounced Postgres mirror save.   |
| `canvases.listComments`, `canvases.embeddedMessages`                                                                                       | `authorized`, `arcjet.read`, `workspaceMember`                  | Read comment threads and access-checked embedded messages.             |
| `canvases.createCommentThread`, `canvases.replyComment`, `canvases.editComment`, `canvases.deleteComment`, `canvases.resolveCommentThread` | `authorized`, `arcjet.write`, `workspaceMember`                 | Mutate Postgres-backed inline comments.                                |
| `canvases.listVersions`, `canvases.getVersion`                                                                                             | `authorized`, `arcjet.read`, `workspaceMember`                  | Browse version metadata and load one snapshot for read-only preview.   |
| `canvases.createVersion`, `canvases.restoreVersion`                                                                                        | `authorized`, `arcjet.write`, `workspaceMember`                 | Save a named checkpoint or restore with a pre-restore safety snapshot. |
| `canvases.draftFromThread`                                                                                                                 | `authorized`, `workspaceMember`, `arcjet.heavyWriteByWorkspace` | Stream an AI canvas draft from a thread with verified source links.    |

**Deferred cleanly after M4.** Indexing `Canvas.markdown` into Upstash Vector (`SearchSyncKind.CANVAS`) so global Search and Ask Conduit cite canvases (PRD overview line 30) and emitting `ActivityItem` entries for canvas comment mentions are deferred to a small follow-up PR. `Canvas.markdown` and `CanvasComment.mentionedUserIds` are persisted from PR1 and PR3 so that follow-up needs no data backfill.

## Appendix C. Alternatives rejected

- **`@liveblocks/react-lexical` and `@liveblocks/node-lexical`.** Both pin exact `lexical: "0.35.0"`. Conduit runs `lexical@0.49.0` with `@lexical/extension` for `Composer` and `@shadcn-editor`. Downgrading Lexical breaks `Composer`, and forcing peer overrides risks dual-Lexical runtime crashes. Pairing `@liveblocks/yjs` with Lexical's own `@lexical/yjs@0.49.0` avoids the version conflict completely.
- **Liveblocks prebuilt UI (`@liveblocks/react-ui` `FloatingToolbar`, `FloatingThreads`, `AnchoredThreads`).** They ship their own CSS and widgets outside `@conduit/ui`, do not render Twemoji or `MentionCard`, and violate `DESIGN.md`'s shadcn rule. Keeping comments in Postgres and editor UI in `apps/client/src/components/editor/` matches Conduit's design system and permissions.
- **Liveblocks managed Version History.** Free tier retains versions for only 24 hours, and extended retention requires the $500/month Team plan. Storing `CanvasVersion` in Postgres gives unlimited history at zero extra vendor cost.
- **Liveblocks `ydocUpdated` webhooks for Postgres mirroring.** Local development runs on `https://*.conduit.localhost`, which Liveblocks servers cannot call without a tunnel, and webhooks throttle to 60 seconds. Client-side debounced `canvases.saveSnapshot` with `contentHash` deduplication works identically locally and in production.
- **Storing message body text inside `MessageEmbedNode`.** Caching message text in Yjs would leak private-channel messages to unauthorized canvas collaborators and show stale text after edits or deletes. Storing only `messageId` keeps Postgres as the access gate.
- **Neon Realtime or custom WebSocket server for CRDT sync.** Vercel serverless functions cannot hold long-lived WebSocket rooms, and the operator selected Liveblocks for multi-user editing.

## Appendix D. Risks

- **Thin adapter mismatch between `@liveblocks/yjs` and `@lexical/yjs@0.49.0` (PR2).** If `LiveblocksYjsProvider` emits `sync` before `CollaborationPlugin` attaches its listener, the editor could miss the initial sync event. The adapter must check `provider.synced` on `connect()` and emit a microtask `sync` when already synced, verified in `liveblocks-yjs-adapter.test.ts` and PR2 Lane 7.
- **Liveblocks Free plan 10 concurrent connections per room (PR2).** A 50-person workspace opening the same `#all` channel canvas at once will hit the 10-connection cap on Free tier. Upgrading to Liveblocks Pro ($25/month) removes the hard stop; PR2 shows a clear reconnect banner if a room connection fails.
- **Stale Postgres snapshot if every editor force-closes tabs before the 30 s debounce (PR2 and PR4).** Liveblocks still retains the authoritative Yjs room state, so the next visitor sees all edits live and flushes the snapshot; adding a `pagehide` `keepalive` flush minimizes the window.
- **Restore racing with an active typer (PR4).** Because restore replaces the Lexical root inside a single Yjs transaction, concurrent edits made in the exact same millisecond merge deterministically, and the pre-restore safety snapshot ensures no prior text is lost.
- **Control skill mapping (All PRs).** Conduit uses `.agents/skills/verify-conduit/SKILL.md` (Playwright in real Chromium) instead of `cursor-team-kit`'s `control-ui`. Live lanes follow `verify-conduit` and save all lane screenshots to the boot recipe path.
- **ESLint `featureDeps` cycle between `threads` and `canvases` (PR5).** `canvases` imports `messages` for `MessageExcerpt`; `threads` must not create a circular dependency. Pass the **Turn into canvas** menu item as a slot prop from the route (`ChannelPage` and `DmPage`) to `ThreadPanel`.

## Appendix E. Links and reading list

- [`PRD.md`](../../PRD.md) (M4 Canvas, Quality targets, AI rules) and [`GLOSSARY.md`](../../GLOSSARY.md).
- [`DESIGN.md`](../../DESIGN.md), `design-taste-frontend` (`SKILL.md`, `references/app-screens.md`, `scripts/lint.mjs --app`, and `scripts/inspect.mjs --app`), and `emil-design-eng` (`SKILL.md`, Animation Decision Framework, Review Checklist, and the required `| Before | After | Why |` PR review table) before every UI commit.
- `apps/client/src/components/editor/` and `apps/client/src/features/messages/lib/composer-extension.ts` for Conduit's `@lexical/extension` setup.
- `apps/client/src/features/messages/components/message/message-excerpt.tsx` for `MessageExcerpt` props and `MentionNames` context.
- `apps/server/src/summaries/` and `apps/server/src/ask/` for `ModelPort.streamObject`, `AiAccessService`, citation verification, and `eval-*.ts` patterns.
- `packages/contract/src/lib/channel-policy.ts` for the policy-table structure PR1 mirrors in `canvas-policy.ts`.
- Run `pstack/skills/how/SKILL.md` before PR2 (`LiveblocksYjsProvider` to `@lexical/yjs@0.49.0` wiring) and PR3 (`MarkNode` + `MessageEmbedNode` Yjs serialization). Run `pstack/skills/interrogate/SKILL.md` on PR2 and PR3 before marking STACK-READY.
- Keep the execution decision trail per `pstack/skills/show-me-your-work/SKILL.md`.
