# DESIGN.md

UI taste for Conduit, written from corrections the owner made. Every rule here is a rule, not a suggestion. When you build or change UI in `apps/client` or `packages/ui`, follow all of them.

## Components

- **Just use shadcn. Every control, form, table, menu, dialog, empty state and loading state is built from `@conduit/ui/components/*`.** Never hand-roll one with raw HTML elements and Tailwind. Before writing markup, open `packages/ui/src/components/` and find the part. When it is missing, add the shadcn component to `packages/ui` first, then use it. This includes `Field` for forms, `Empty` for empty states, and `Skeleton` for loading states.
  Why: hand-built controls drift from the kit's spacing, focus and theme, and the owner had to point out `field.tsx`, `empty.tsx` and `skeleton.tsx` one by one. `apps/client/eslint.config.mjs` blocks the raw elements in feature code.
  <!-- 2026-11-13: "Why not use field.tsx components"; "just fucking use shadcn" -->

## Surfaces

- **Tabs directly under a page header have no top border.** The header and its tabs read as one block. Only the line under the tabs stays.
  Why: a line between them cuts the header off from its own tabs.
  <!-- 2026-11-13: "I don't like the top border of the view tabs, remove it" -->
- **Every empty, no-results and error state uses the `Empty` parts from `@conduit/ui/components/empty`, centred in the area the content would fill.** Give it an icon, a title, one sentence and at most one action. Let the scroll area stretch so it centres vertically.
  Why: a centred empty state reads as deliberate, not as a broken list.
  <!-- 2026-11-13: "render the empty states at the center of the page using empty.tsx" -->
- **Grouped controls (button groups, toggle groups) and popups (select, dropdown, combobox content) use `rounded-md`. Items inside a menu use `rounded-sm`.** Never `rounded-lg` on these.
  Why: a radius nested inside another must be smaller than its container.
  <!-- 2026-11-13: owner changed rounded-lg → rounded-md in button-group, toggle-group, select; rounded-md → rounded-sm on menu items -->

- **Every AI feature a person starts (thread, channel and DM summaries, Catch me up, and any new one) opens in a `Dialog`. Never render its output inline in the page.** Passive AI labels, such as the urgency note on an Activity row, stay inline.
  Why: the output is temporary and must not push the conversation or the feed around.
  <!-- 2026-11-14: "I prefer a dialog for each AI feature, instead of rendering them inline." -->

## Color

- **Link-style text and mention pills use `text-link` (the `--color-link` token), never `text-primary`.**
  Why: the primary color is for actions, so links get their own color.
  <!-- 2026-11-09: owner replaced text-primary / --color-primary with text-link / --color-link in message-row and typeset.css -->

## Typography

- **Every emoji the UI shows renders through the Twemoji component, never the system font.** That covers message text, reaction pills, pickers, suggestion menus and the composer. Emoji inside code stay as typed.
  Why: emoji must look the same on every platform.
  <!-- 2026-11-10: "render the emojis with Twemoji so that they look the same across all platforms" -->
- **An icon inside a `Button` gets `data-icon="inline-start"` or `data-icon="inline-end"` and no size class.**
  Why: the button variant then sizes and spaces the icon.
  <!-- 2026-11-07, 2026-11-09: owner replaced size-3.5 classes with data-icon="inline-start" in settings-nav and message-row -->

- **Text an AI model writes renders through `Markdown` from `@/components/markdown`, never as plain text.**
  Why: the same text, once shared to a channel, renders as Markdown, so the dialog must show it the same way.
  <!-- 2026-11-14: "Why not use the markdown rendering? Our own markdown renderer?" -->

## Spacing & layout

- **List pages (feeds, tables, Activity) span the full content width with equal side padding. Never cap the whole column with `max-w-*`.** Form pages such as settings may cap at a reading width.
  Why: a capped list column leaves an enormous empty gap on wide screens.
  <!-- 2026-11-13: "There's an enormous gap on the right side" -->
- **Form layouts use the `Field` parts (`FieldSet`, `FieldLegend`, `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`). Never a raw `<fieldset>`, `<legend>` or `<label>`.**
  Why: form spacing and the label-to-input link stay the same everywhere. Lint enforces it.
  <!-- 2026-11-13: "Why not use field.tsx components for feed-filter-popover.tsx?" -->

## Motion

- **Suspense fallbacks are `Skeleton` blocks with fixed widths, sized to the loaded layout.** Measure the loaded page (Playwright) rather than guessing. Static UI (headers, labels, nav) renders outside the `<Suspense>` boundary; only data-driven parts wait behind it.
  Why: nothing shifts when the data arrives, and static parts show instantly.
  <!-- 2026-11-07: "Use skeleton.tsx … calculate the exact pixel … static UIs don't need to be in <Suspense />" -->
- **Popups keep their open and close animation. Never add `animate-none!` to them.**
  Why: a popup that just appears feels abrupt.
  <!-- 2026-11-07: owner removed animate-none! from combobox, context-menu, dropdown-menu, select -->

- **An AI loading state shows `AILoader` (`@conduit/ui/components/ai-loader`) in the leading slot (the bullet gutter or icon spot), and its status text uses the `shimmer` class from `shadcn/tailwind.css`.** Never a spinner, a `Skeleton` or an empty indent. Each caller picks a `dotSize` that fits its slot.
  Why: every AI wait looks the same and leaves no blank gap.
  <!-- 2026-11-14: "Use shadcn text-shimmer css for the AI loading"; "render the ai-loader.tsx to replace that gap"; owner set dotSize={2} in the summary dialog -->

## Interaction

- **Typeahead and picker menus (mentions, emoji, commands) keep every row one fixed height: icon or avatar, the name, and at most a short tag such as "You". The highlighted row's full detail (email, description) shows in a fixed-height footer strip, never inside the row.**
  Why: people with the same name or avatar must be told apart, and detail swapped into a row cuts off the name and makes it jump as the highlight moves.
  <!-- 2026-11-10: "how about always show the mail but only on hover/highlight?", then picked the footer strip -->
- **A search that filters a list sits in that list's toolbar, next to its Filter control, as an icon that opens a field.** Never put it in the page header.
  Why: the "what am I looking at" controls belong together.
  <!-- 2026-11-13: "I don't think placing the filter search input at that position would bring a good UX" -->
- **A control whose menu sets a state always shows the current value in its trigger, with a default label ("None") when nothing is set.**
  Why: the person can see the current state without opening the menu.
  <!-- 2026-11-13: "Don't just render the checkbox, render the select content label too (render the default one if none selected)" -->

- **AI responses stream into view as the model writes them. The reasoning trace is never sent to the client or shown.**
  Why: people watch the answer form instead of waiting on a loader, and reasoning is noise to them.
  <!-- 2026-11-14: "stream AI response (response only, do not render reasoning trace)" -->

## Code style

- **JSX conditionals use `cond && (…)`, never `cond ? (…) : null`. When the condition is a number, use the ternary**, so a `0` never renders.
  Why: `&&` is shorter to read; the number case is the one place it leaks. Lint flags the ternary; disable it on the line for a number condition.
  <!-- 2026-11-07: owner rewrote `? … : null` to `&&` in member-actions, workspace-header; 2026-11-14: "When a condition is a number, use ternary." -->
- **Changing the search params of the page on screen (`thread`, `message`, filters) goes through nuqs (`useQueryState` / `useQueryStates`).** Never a `<Link>`, `router.push` or `useSearchParams` to the same page. Lint bans `useSearchParams`.
  Why: a Next navigation updates the URL, but nuqs state never sees the change, so nothing reacts.
  <!-- 2026-11-14: "It only append the query param to the url, but not changing the state. Use nuqs for that." -->
