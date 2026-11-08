'use client';

import type { ChannelSection } from '@conduit/contract';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { SidebarGroupAction } from '@conduit/ui/components/sidebar';
import {
  IconArrowDown,
  IconArrowUp,
  IconDots,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { toast } from 'sonner';

import { useDeleteChannelSection } from '@/services/channels/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';

/** Rename, delete, and reorder one of the viewer's own sections. */
export function SidebarSectionMenu({
  section,
  onMove,
}: {
  section: ChannelSection;
  /** `null` where the section cannot move that way. */
  onMove: { up: (() => void) | null; down: (() => void) | null };
}) {
  const { open } = useChannelDialogs();
  const { mutateAsync: deleteSection } = useDeleteChannelSection();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarGroupAction aria-label={`Actions for ${section.name}`} />
        }
      >
        <IconDots />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => open({ kind: 'section-name', section })}
        >
          <IconPencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!onMove.up}
          onClick={onMove.up ?? undefined}
        >
          <IconArrowUp />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!onMove.down}
          onClick={onMove.down ?? undefined}
        >
          <IconArrowDown />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* mutateAsync, not mutate: the menu closes on click, and per-call callbacks die with it. */}
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            deleteSection({ sectionId: section.id }).catch((error: Error) =>
              toast.error(error.message)
            )
          }
        >
          <IconTrash />
          Delete section
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
