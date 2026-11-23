'use client';

import type { ChannelSection } from '@conduit/contract';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  IconArrowDown,
  IconArrowUp,
  IconFolderPlus,
  IconHash,
  IconListSearch,
  IconLock,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';

import { RoomGroupAdd } from '@/features/rooms/components/room-sidebar';
import {
  useDeleteChannelSection,
  useMoveChannelToSection,
  useReorderChannelSections,
} from '@/services/channels/hooks';
import {
  channelSectionsQuery,
  channelsQuery,
} from '@/services/channels/queries';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { useCanCreateChannel } from '../../hooks/use-can-create-channel';

function ChannelGroupCreateItems() {
  const { open } = useChannelDialogs();
  const canCreate = useCanCreateChannel('private');

  return (
    <>
      {canCreate && (
        <DropdownMenuItem onClick={() => open({ kind: 'create' })}>
          <IconPlus data-slot="icon" />
          Create a new channel
        </DropdownMenuItem>
      )}
      <DropdownMenuItem render={<Link href="/directories/channels" />}>
        <IconListSearch data-slot="icon" />
        Browse channels
      </DropdownMenuItem>
    </>
  );
}

/** The Channels group's own rows of its "More actions" menu: add a channel, or start a section. */
export function ChannelGroupMenuItems() {
  const { open } = useChannelDialogs();

  return (
    <>
      <ChannelGroupCreateItems />
      <DropdownMenuItem onClick={() => open({ kind: 'section-name' })}>
        <IconFolderPlus data-slot="icon" />
        New section
      </DropdownMenuItem>
    </>
  );
}

/** A section's own rows of its "More actions" menu: rename it, move it among the viewer's sections, delete it. */
export function ChannelGroupSectionMenuItems({
  section,
}: {
  section: ChannelSection;
}) {
  const { open } = useChannelDialogs();
  const { data: sections = [] } = useQuery(channelSectionsQuery);
  const { mutate: reorder } = useReorderChannelSections();
  const { mutateAsync: deleteSection } = useDeleteChannelSection();

  const sectionIds = [...sections]
    .sort((a, b) => a.position - b.position)
    .map(({ id }) => id);
  const from = sectionIds.indexOf(section.id);
  // Swaps the section with its neighbour; undefined where there is none to swap with.
  const moveBy = (step: -1 | 1) => {
    const to = from + step;
    if (from < 0 || to < 0 || to >= sectionIds.length) return undefined;
    return () => {
      const next = [...sectionIds];
      [next[from], next[to]] = [next[to]!, next[from]!];
      reorder({ sectionIds: next });
    };
  };
  const up = moveBy(-1);
  const down = moveBy(1);

  return (
    <>
      <DropdownMenuItem onClick={() => open({ kind: 'section-name', section })}>
        <IconPencil data-slot="icon" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!up} onClick={up}>
        <IconArrowUp data-slot="icon" />
        Move up
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!down} onClick={down}>
        <IconArrowDown data-slot="icon" />
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
        <IconTrash data-slot="icon" />
        Delete section
      </DropdownMenuItem>
    </>
  );
}

function ChannelGroupSectionPicker({ section }: { section: ChannelSection }) {
  const { data: channels = [] } = useQuery(channelsQuery);
  const { mutate: move } = useMoveChannelToSection();
  // A starred channel shows under Favorites wherever it is filed, so filing it here would look like nothing happened.
  const others = channels.filter(
    ({ membership }) =>
      membership && !membership.starredAt && membership.sectionId !== section.id
  );

  if (others.length === 0) {
    return (
      <DropdownMenuItem disabled>No other channels to add</DropdownMenuItem>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto">
      {others.map((channel) => (
        <DropdownMenuItem
          key={channel.id}
          onClick={() => move({ roomId: channel.id, sectionId: section.id })}
        >
          {channel.visibility === 'private' ? <IconLock /> : <IconHash />}
          <span className="truncate">{channel.name}</span>
        </DropdownMenuItem>
      ))}
    </div>
  );
}

/**
 * The "Add channels" row that ends a channel group. Under Channels it creates or browses. Under a section it
 * files one of the viewer's other channels there.
 */
export function ChannelGroupAdd({
  section,
}: {
  section: ChannelSection | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<RoomGroupAdd />}>
        Add channels
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {section ? (
          <ChannelGroupSectionPicker section={section} />
        ) : (
          <ChannelGroupCreateItems />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
