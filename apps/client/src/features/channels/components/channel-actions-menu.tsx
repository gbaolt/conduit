'use client';

import type { Channel } from '@conduit/contract';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@conduit/ui/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import type { ComponentProps, ReactElement } from 'react';
import { toast } from 'sonner';

import { useLeaveChannel } from '@/services/channels/hooks';
import { useWorkspaceRole } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../context/channel-dialogs-provider';
import { getChannelActions } from '../lib/channel-actions';
import { useExitOpenChannel } from '../lib/use-exit-open-channel';

// Only the open menu mounts this, so a sidebar of rows pays for none of it until a menu opens.
function useChannelActions(channel: Channel) {
  const { open } = useChannelDialogs();
  const workspaceRole = useWorkspaceRole();
  const exitOpenChannel = useExitOpenChannel();
  const { mutateAsync: leaveChannel } = useLeaveChannel();

  // mutateAsync, not mutate: the menu closes on click, and per-call callbacks die with the menu.
  const leave = (target: Channel) =>
    leaveChannel({ channelId: target.id }).then(
      () => exitOpenChannel(target.id),
      (error: Error) => toast.error(error.message)
    );

  const actions = getChannelActions(channel, { workspaceRole }).map(
    (action) => ({ ...action, run: () => action.run({ open, leave }) })
  );

  // Destructive actions sit apart, below a separator.
  return {
    regular: actions.filter((action) => !action.destructive),
    destructive: actions.filter((action) => action.destructive),
  };
}

function DropdownActionItems({ channel }: { channel: Channel }) {
  const { regular, destructive } = useChannelActions(channel);

  return (
    <>
      {regular.map(({ id, label, icon: Icon, run }) => (
        <DropdownMenuItem key={id} onClick={run}>
          <Icon />
          {label}
        </DropdownMenuItem>
      ))}
      {regular.length > 0 && destructive.length > 0 && (
        <DropdownMenuSeparator />
      )}
      {destructive.map(({ id, label, icon: Icon, run }) => (
        <DropdownMenuItem key={id} variant="destructive" onClick={run}>
          <Icon />
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function ContextActionItems({ channel }: { channel: Channel }) {
  const { regular, destructive } = useChannelActions(channel);

  return (
    <>
      {regular.map(({ id, label, icon: Icon, run }) => (
        <ContextMenuItem key={id} onClick={run}>
          <Icon />
          {label}
        </ContextMenuItem>
      ))}
      {regular.length > 0 && destructive.length > 0 && <ContextMenuSeparator />}
      {destructive.map(({ id, label, icon: Icon, run }) => (
        <ContextMenuItem key={id} variant="destructive" onClick={run}>
          <Icon />
          {label}
        </ContextMenuItem>
      ))}
    </>
  );
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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownActionItems channel={channel} />
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
      <ContextMenuContent className="w-48">
        <ContextActionItems channel={channel} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
