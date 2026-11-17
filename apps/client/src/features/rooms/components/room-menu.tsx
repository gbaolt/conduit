'use client';

import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@conduit/ui/components/context-menu';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { useParams } from 'next/navigation';
import { createContext, use } from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import { useSplit } from '@/hooks/use-split';

export const roomDropdownMenuParts = {
  Group: DropdownMenuGroup,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubContent: DropdownMenuSubContent,
  SubTrigger: DropdownMenuSubTrigger,
};

export const roomContextMenuParts: typeof roomDropdownMenuParts = {
  Group: ContextMenuGroup,
  Item: ContextMenuItem,
  Label: ContextMenuLabel,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubContent: ContextMenuSubContent,
  SubTrigger: ContextMenuSubTrigger,
};

/** The menu primitives in use, so one set of rows renders as a dropdown or a context menu. */
export const RoomMenuParts = createContext(roomDropdownMenuParts);

/**
 * "Open in split view": the room beside the conversation on screen. It shows only where the side card docks,
 * on a conversation page, and never for the conversation already open.
 */
export function RoomMenuSplitItem({ roomId }: { roomId: string }) {
  const Menu = use(RoomMenuParts);
  const [, setSplit] = useSplit();
  const { roomId: openRoomId } = useParams<{ roomId?: string }>();
  const docked = useMediaQuery('(min-width: 80rem)');

  if (!docked || !openRoomId || openRoomId === roomId) return null;

  return (
    <Menu.Item
      onClick={() =>
        void setSplit({ room: roomId, thread: null, message: null })
      }
    >
      Open in split view
    </Menu.Item>
  );
}
