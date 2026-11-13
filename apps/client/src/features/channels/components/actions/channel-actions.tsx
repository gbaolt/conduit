'use client';

import type { Room } from '@conduit/contract';
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
import { IconCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  type ComponentProps,
  Fragment,
  type ReactElement,
  type ReactNode,
  use,
} from 'react';
import { toast } from 'sonner';

import {
  roomContextMenuParts,
  roomDropdownMenuParts,
  RoomMenuParts,
} from '@/features/rooms/components/room-menu';
import { RoomNotifyMenu } from '@/features/rooms/components/room-notify-menu';
import {
  useLeaveChannel,
  useMoveChannelToSection,
  useStarChannel,
  useUnstarChannel,
} from '@/services/channels/hooks';
import { channelSectionsQuery } from '@/services/channels/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import {
  type ChannelMenuGroup,
  type ChannelSubmenu,
  getChannelActions,
} from '../../lib/channel-actions';
import { useExitOpenChannel } from '../../lib/use-exit-open-channel';

// Only the open menu mounts this, so a sidebar of rows pays for none of it until a menu opens.
function useChannelActions(channel: Room) {
  const { open } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const exitOpenChannel = useExitOpenChannel();
  const { mutateAsync: leaveChannel } = useLeaveChannel();
  const { mutate: star } = useStarChannel();
  const { mutate: unstar } = useUnstarChannel();
  const { mutate: moveChannel } = useMoveChannelToSection();
  const { data: sections } = useQuery(channelSectionsQuery);

  // mutateAsync, not mutate: the menu closes on click, and per-call callbacks die with the menu.
  const leave = (target: Room) =>
    leaveChannel({ roomId: target.id }).then(
      () => exitOpenChannel(target.id),
      (error: Error) => toast.error(error.message)
    );

  // star and move report failures through their own onError, so the menu closing on click loses nothing.
  const context = {
    open,
    leave,
    setStarred: (target: Room, starred: boolean) =>
      (starred ? star : unstar)({ roomId: target.id }),
    moveToSection: (target: Room, sectionId: string | null) =>
      moveChannel({ roomId: target.id, sectionId }),
  };
  const actions = getChannelActions(channel, { workspaceRole, sections }).map(
    (action) =>
      'items' in action
        ? {
            ...action,
            items: action.items.map((item) => ({
              ...item,
              run: () => item.run(context),
            })),
          }
        : { ...action, run: () => action.run(context) }
  );

  return actions;
}

type Action = ReturnType<typeof useChannelActions>[number];

const SUBMENU_LABELS: Record<ChannelSubmenu, string> = {
  details: 'Channel details',
  copy: 'Copy',
};

function SubmenuRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const Menu = use(RoomMenuParts);

  return (
    <Menu.Sub>
      <Menu.SubTrigger>{label}</Menu.SubTrigger>
      <Menu.SubContent className="w-40">{children}</Menu.SubContent>
    </Menu.Sub>
  );
}

function ActionRow({ action }: { action: Action }) {
  const Menu = use(RoomMenuParts);

  if ('items' in action) {
    return (
      <SubmenuRow label={action.label}>
        {action.items.map(({ id, label, icon: Icon, checked, run }) => (
          <Menu.Item key={id} onClick={run}>
            <Icon data-slot="icon" aria-hidden />
            {label}
            {checked && <IconCheck className="ml-auto" />}
          </Menu.Item>
        ))}
      </SubmenuRow>
    );
  }

  return (
    <Menu.Item
      variant={action.group === 'danger' ? 'destructive' : 'default'}
      onClick={action.run}
    >
      {action.icon && <action.icon data-slot="icon" aria-hidden />}
      {action.label}
    </Menu.Item>
  );
}

/** Rows of one group: submenus in their fixed order first, then the top-level rows. */
function ActionRows({ actions }: { actions: Action[] }) {
  const submenus = (Object.keys(SUBMENU_LABELS) as ChannelSubmenu[]).flatMap(
    (submenu) => {
      const rows = actions.filter((action) => action.submenu === submenu);
      return rows.length > 0 ? [{ submenu, rows }] : [];
    }
  );

  return (
    <>
      {submenus.map(({ submenu, rows }) => (
        <SubmenuRow key={submenu} label={SUBMENU_LABELS[submenu]}>
          {rows.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </SubmenuRow>
      ))}
      {actions
        .filter((action) => !action.submenu)
        .map((action) => (
          <ActionRow key={action.id} action={action} />
        ))}
    </>
  );
}

/** The channel's menu as separated groups; an empty group and its separator are left out. */
function ChannelMenuItems({ channel }: { channel: Room }) {
  const Menu = use(RoomMenuParts);
  const actions = useChannelActions(channel);
  const rows = (group: ChannelMenuGroup) => {
    const inGroup = actions.filter((action) => action.group === group);
    return inGroup.length > 0 ? <ActionRows actions={inGroup} /> : null;
  };

  const groups = [
    { id: 'main', content: rows('main') },
    {
      id: 'notify',
      content: channel.membership ? <RoomNotifyMenu room={channel} /> : null,
    },
    { id: 'organize', content: rows('organize') },
    { id: 'danger', content: rows('danger') },
  ].filter(({ content }) => content !== null);

  return groups.map(({ id, content }, index) => (
    <Fragment key={id}>
      {index > 0 && <Menu.Separator />}
      <Menu.Group>{content}</Menu.Group>
    </Fragment>
  ));
}

/** The channel's actions as a dropdown. `trigger` is the button element; `children` is its content. */
export function ChannelActionsDropdown({
  channel,
  trigger,
  extra,
  children,
}: {
  channel: Room;
  trigger: ReactElement;
  /** Rows another feature adds after the channel's own, such as the summary menu. */
  extra?: ReactNode;
  children: ComponentProps<typeof DropdownMenuTrigger>['children'];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <RoomMenuParts value={roomDropdownMenuParts}>
          <ChannelMenuItems channel={channel} />
        </RoomMenuParts>
        {extra}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same actions on right-click. `render` is the element that receives the right-click, e.g. the row's `li`. */
export function ChannelActionsContextMenu({
  channel,
  render,
  children,
}: {
  channel: Room;
  render: ReactElement;
  children: ComponentProps<typeof ContextMenuTrigger>['children'];
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <RoomMenuParts value={roomContextMenuParts}>
          <ChannelMenuItems channel={channel} />
        </RoomMenuParts>
      </ContextMenuContent>
    </ContextMenu>
  );
}
