'use client';

import type { Dm } from '@conduit/contract';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@conduit/ui/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  IconCopy,
  IconInfoCircle,
  IconLink,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  use,
} from 'react';

import {
  roomContextMenuParts,
  roomDropdownMenuParts,
  RoomMenuParts,
  RoomMenuSplitItem,
} from '@/features/rooms/components/room-menu';
import { RoomNotifyMenu } from '@/features/rooms/components/room-notify-menu';
import { copyText } from '@/features/rooms/lib/copy-text';
import { useIsUnread } from '@/services/activity/hooks';
import { sessionQuery } from '@/services/auth/queries';
import { dmTitle } from '@/services/dms/dm-title';
import { useCloseDms } from '@/services/dms/hooks';
import {
  useMarkRoomsRead,
  useStarRoom,
  useUnstarRoom,
} from '@/services/rooms/hooks';

import { useDmDialogs } from '../../context/dm-dialogs-provider';

// Only the open menu mounts this, so a list of rows pays for none of it until a menu opens.
function DmActionsItems({ dm }: { dm: Dm }) {
  const Menu = use(RoomMenuParts);
  const { open } = useDmDialogs();
  const { data: session } = useQuery(sessionQuery);
  const unread = useIsUnread(dm.id);
  // mutate, not mutateAsync: each hook reports its own failure, so the menu closing on click loses nothing.
  const { mutate: star } = useStarRoom();
  const { mutate: unstar } = useUnstarRoom();
  const { mutate: markRead } = useMarkRoomsRead();
  const { mutate: close } = useCloseDms();
  const starred = !!dm.membership.starredAt;

  return (
    <>
      <Menu.Group>
        <Menu.Sub>
          <Menu.SubTrigger>Conversation details</Menu.SubTrigger>
          <Menu.SubContent className="w-56">
            <Menu.Item
              onClick={() => open({ kind: 'dm-details', roomId: dm.id })}
            >
              <IconInfoCircle data-slot="icon" aria-hidden />
              View details
            </Menu.Item>
            <Menu.Item
              onClick={() => open({ kind: 'dm-add-people', roomId: dm.id })}
            >
              <IconUserPlus data-slot="icon" aria-hidden />
              Add people
            </Menu.Item>
            <Menu.Item
              onClick={() => open({ kind: 'dm-convert', roomId: dm.id })}
            >
              <IconUsers data-slot="icon" aria-hidden />
              Turn into a private channel
            </Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
        <Menu.Sub>
          <Menu.SubTrigger>Copy</Menu.SubTrigger>
          <Menu.SubContent className="w-40">
            <Menu.Item
              onClick={() => copyText(dmTitle(dm, session?.user.id ?? ''))}
            >
              <IconCopy data-slot="icon" aria-hidden />
              Copy name
            </Menu.Item>
            <Menu.Item
              onClick={() => copyText(`${location.origin}/dms/${dm.id}`)}
            >
              <IconLink data-slot="icon" aria-hidden />
              Copy link
            </Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
        <Menu.Item onClick={() => (starred ? unstar : star)({ roomId: dm.id })}>
          {starred ? 'Unstar conversation' : 'Star conversation'}
        </Menu.Item>
        <Menu.Item
          disabled={!unread}
          onClick={() => markRead({ roomIds: [dm.id] })}
        >
          Mark as read
        </Menu.Item>
        <RoomMenuSplitItem roomId={dm.id} />
      </Menu.Group>
      <Menu.Separator />
      <Menu.Group>
        <RoomNotifyMenu
          room={{ id: dm.id, kind: 'dm', membership: dm.membership }}
        />
      </Menu.Group>
      <Menu.Separator />
      <Menu.Group>
        <Menu.Item onClick={() => close({ roomIds: [dm.id] })}>
          Close conversation
        </Menu.Item>
      </Menu.Group>
    </>
  );
}

/** The DM's actions as a dropdown. `trigger` is the button element; `children` is its content. */
export function DmActionsDropdown({
  dm,
  trigger,
  extra,
  children,
}: {
  dm: Dm;
  trigger: ReactElement;
  /** Rows another feature adds after the DM's own, such as the summary menu. */
  extra?: ReactNode;
  children: ComponentProps<typeof DropdownMenuTrigger>['children'];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <RoomMenuParts value={roomDropdownMenuParts}>
          <DmActionsItems dm={dm} />
        </RoomMenuParts>
        {extra}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same actions on right-click. `render` is the element that receives the right-click, e.g. the row's `li`. */
export function DmActionsContextMenu({
  dm,
  render,
  children,
}: {
  dm: Dm;
  render: ReactElement;
  children: ComponentProps<typeof ContextMenuTrigger>['children'];
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <RoomMenuParts value={roomContextMenuParts}>
          <DmActionsItems dm={dm} />
        </RoomMenuParts>
      </ContextMenuContent>
    </ContextMenu>
  );
}
