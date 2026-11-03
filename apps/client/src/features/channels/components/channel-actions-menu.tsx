'use client';

import type { Channel } from '@conduit/contract';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@conduit/ui/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  IconBell,
  IconBellOff,
  IconBellRinging,
  IconCheck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  type ComponentProps,
  createContext,
  Fragment,
  type ReactElement,
  type ReactNode,
  use,
  useState,
} from 'react';
import { toast } from 'sonner';

import {
  useLeaveChannel,
  useMoveChannelToSection,
  useStarChannel,
  useUnstarChannel,
} from '@/services/channels/hooks';
import { channelSectionsQuery } from '@/services/channels/queries';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../context/channel-dialogs-provider';
import {
  type ChannelMenuGroup,
  type ChannelSubmenu,
  getChannelActions,
} from '../lib/channel-actions';
import { useExitOpenChannel } from '../lib/use-exit-open-channel';

// Only the open menu mounts this, so a sidebar of rows pays for none of it until a menu opens.
function useChannelActions(channel: Channel) {
  const { open } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const exitOpenChannel = useExitOpenChannel();
  const { mutateAsync: leaveChannel } = useLeaveChannel();
  const { mutate: star } = useStarChannel();
  const { mutate: unstar } = useUnstarChannel();
  const { mutate: moveChannel } = useMoveChannelToSection();
  const { data: sections } = useQuery(channelSectionsQuery);

  // mutateAsync, not mutate: the menu closes on click, and per-call callbacks die with the menu.
  const leave = (target: Channel) =>
    leaveChannel({ channelId: target.id }).then(
      () => exitOpenChannel(target.id),
      (error: Error) => toast.error(error.message)
    );

  // star and move report failures through their own onError, so the menu closing on click loses nothing.
  const context = {
    open,
    leave,
    setStarred: (target: Channel, starred: boolean) =>
      (starred ? star : unstar)({ channelId: target.id }),
    moveToSection: (target: Channel, sectionId: string | null) =>
      moveChannel({ channelId: target.id, sectionId }),
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

const dropdownParts = {
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

const contextParts: typeof dropdownParts = {
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

/** The menu primitives in use, so one layout renders as a dropdown or a context menu. */
const MenuParts = createContext(dropdownParts);

type Action = ReturnType<typeof useChannelActions>[number];

const SUBMENU_LABELS: Record<ChannelSubmenu, string> = {
  details: 'Channel details',
  copy: 'Copy',
};

const NOTIFY_OPTIONS = [
  { value: 'all', label: 'All new posts', icon: IconBellRinging },
  { value: 'mentions', label: 'Just mentions', icon: IconBell },
  { value: 'mute', label: 'Mute and hide', icon: IconBellOff },
];

function SubmenuRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const Menu = use(MenuParts);

  return (
    <Menu.Sub>
      <Menu.SubTrigger>{label}</Menu.SubTrigger>
      <Menu.SubContent className="w-40">{children}</Menu.SubContent>
    </Menu.Sub>
  );
}

function ActionRow({ action }: { action: Action }) {
  const Menu = use(MenuParts);

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

function NotifyRows() {
  const Menu = use(MenuParts);
  const [notify, setNotify] = useState('all');

  return (
    <>
      <Menu.Label>Notifications</Menu.Label>
      <Menu.RadioGroup value={notify} onValueChange={setNotify}>
        {NOTIFY_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Menu.RadioItem key={value} value={value}>
            <Icon data-slot="icon" aria-hidden />
            {label}
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
    </>
  );
}

/** The channel's menu as separated groups; an empty group and its separator are left out. */
function ChannelMenuItems({ channel }: { channel: Channel }) {
  const Menu = use(MenuParts);
  const actions = useChannelActions(channel);
  const rows = (group: ChannelMenuGroup) => {
    const inGroup = actions.filter((action) => action.group === group);
    return inGroup.length > 0 ? <ActionRows actions={inGroup} /> : null;
  };

  const groups = [
    { id: 'main', content: rows('main') },
    { id: 'notify', content: channel.membership ? <NotifyRows /> : null },
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
  children,
}: {
  channel: Channel;
  trigger: ReactElement;
  children: ComponentProps<typeof DropdownMenuTrigger>['children'];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <MenuParts value={dropdownParts}>
          <ChannelMenuItems channel={channel} />
        </MenuParts>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same actions on right-click. `render` is the element that receives the right-click, e.g. the row's `li`. */
export function ChannelContextMenu({
  channel,
  render,
  children,
}: {
  channel: Channel;
  render: ReactElement;
  children: ComponentProps<typeof ContextMenuTrigger>['children'];
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <MenuParts value={contextParts}>
          <ChannelMenuItems channel={channel} />
        </MenuParts>
      </ContextMenuContent>
    </ContextMenu>
  );
}
