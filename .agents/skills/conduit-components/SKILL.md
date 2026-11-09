---
name: conduit-components
description: How Conduit organizes and composes React components the shadcn way, as families of parts that callers assemble. Use when adding, splitting, or reshaping a component in apps/client, or a variant in packages/ui.
---

# Conduit components

Conduit builds components the way shadcn ships `sidebar.tsx`: a **family** of small parts that share a name prefix and a context, which callers assemble as children. `features/rooms/components/room-sidebar.tsx` is the reference family, and `features/dms/components/dm-group.tsx` shows it assembled.

You are done when every component you added belongs to a family file named after it, each state or mode is its own composition of parts, each part wraps its `@conduit/ui` counterpart, and UI that two room kinds share lives in `features/rooms`.

## Families and files

A family is the parts of one UI piece: `RoomGroup`, `RoomGroupLabel`, `RoomGroupContent`, `RoomItem`, `RoomItemButton`, `RoomItemLabel`, `RoomItemDraft`. Parts that need shared state read it from the family's context, as `RoomItem` reads `RoomGroup`'s collapsed state and `MessageHeader` reads whether its `Message` is grouped.

| What                         | Where                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A family's parts             | one file named after the family, exporting only `Family*` names: `room-sidebar.tsx` exports `Room*`                                |
| A family that grows          | a folder named after it, the parts in its base file and each variant beside them: `message/message.tsx`, `message/message-row.tsx` |
| Code only one family uses    | inside that family's folder, as `message/message-markdown.tsx`                                                                     |
| Sibling families of one area | an area folder named for the place in the UI: `sidebar/`, `header/`, `dialogs/`, `workspace-settings/`                             |

A component's name tells you its file: `MessageRow` lives in `message/message-row.tsx`, and `ConversationTyping` in `conversation/conversation-typing.tsx`. A component that belongs to another family gets its own file. Lint checks the prefix, so its error names the file to move to.

## Compose the parts

Callers assemble parts as children, and the route assembles the shell:

```tsx
<WorkspaceSidebar defaultLayout={layout}>
  <WorkspaceSidebarPanel>
    <WorkspaceSidebarNav aria-label="Channels">
      <WorkspaceHeader />
      <WorkspaceNav />
      <ChannelGroups />
      <DmGroup />
    </WorkspaceSidebarNav>
  </WorkspaceSidebarPanel>
  <WorkspaceSidebarMain>{children}</WorkspaceSidebarMain>
</WorkspaceSidebar>
```

- **A state is a composition.** The loading fallback in `app/(dashboard)/(home)/layout.tsx` swaps `<ChannelGroupsSkeleton />` in where `<ChannelGroups />` goes, and the shell stays the same.
- **A mode is a variant.** `MessageRow`, `MessagePending` and `MessageExcerpt` each compose `Message`, `MessageAvatar` and `MessageHeader` their own way. Give a component a variant per mode once a boolean prop would switch its layout.
- **Content is children.** A part takes `children` where a caller decides what goes inside, as `RoomItemButton` holds the glyph, label and draft pencil.
- **The same UI shares parts.** A channel row and a DM row both compose `RoomItem`, so both get unread and draft state. When two components render one layout, move the parts to the base that both reach.
- **Siblings stay independent.** `ChannelGroups` and `DmGroup` each render themselves, and the route places them.

Split a component into a family once three or more variants render the same layout. A component with one layout stays one component.

## Parts, variants, routes

| Layer   | Does                                                    | Example                                  |
| ------- | ------------------------------------------------------- | ---------------------------------------- |
| part    | renders a `@conduit/ui` part, reads the family context  | `RoomItemButton`, `MessageAvatar`        |
| variant | fetches through `services/` hooks and composes parts    | `DmGroup`, `ChannelGroups`, `MessageRow` |
| route   | composes variants and the shell, holds no feature logic | `app/(dashboard)/(home)/layout.tsx`      |

## Build on `@conduit/ui`

Each part wraps its shadcn counterpart and adds what only the app knows: `RoomGroupLabel` renders `SidebarGroupLabel`, and `Message` renders `UI.Message`. When a part has no counterpart, add the shadcn component to `packages/ui` first.

| Style                                                  | Home                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Color, typography, hover and focus treatment           | a `cva` variant in `packages/ui`, as in `buttonVariants` and `messageVariants` |
| App state such as highlighted, focused, grouped        | a `data-*` attribute the part sets. The variant owns its color                 |
| Layout of the surrounding list: gutters, padding, gaps | the part's `className`                                                         |
| Motion tied to app timing, such as a new row fading in | the part's `className`                                                         |

Set the variant once on the root part. Child parts style themselves with `group-data-[variant=…]/<slot>:` selectors, as `UI.MessageAvatar` does with `group-data-[variant=log]/message:`. Adding a variant is the one reason to change an existing `packages/ui` file. A variant axis earns its place when callers pick between two or more real values, as the eight `size`s of `button.tsx` do.

## Prop shapes

Parts take entity types from `@conduit/contract`, or a `Pick` of one when they need a few fields, as `Author = Pick<WorkspaceMember, 'name' | 'image'>` does. A union that one module switches on, such as a dialog kind, stays beside that module.
