'use client';

import type { Channel } from '@conduit/contract';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@conduit/ui/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { IconCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps, ReactElement } from 'react';
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
import { getChannelActions } from '../lib/channel-actions';
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
      {regular.map((action) =>
        'items' in action ? (
          <DropdownMenuSub key={action.id}>
            <DropdownMenuSubTrigger>
              <action.icon />
              {action.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-32">
              {action.items.map(({ id, label, checked, run }) => (
                <DropdownMenuItem key={id} onClick={run}>
                  {label}
                  {checked && <IconCheck className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem key={action.id} onClick={action.run}>
            <action.icon />
            {action.label}
          </DropdownMenuItem>
        )
      )}
      {regular.length > 0 && destructive.length > 0 && (
        <DropdownMenuSeparator />
      )}
      {destructive.map((action) => (
        <DropdownMenuItem
          key={action.id}
          variant="destructive"
          onClick={'run' in action ? action.run : undefined}
        >
          <action.icon />
          {action.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function ContextActionItems({ channel }: { channel: Channel }) {
  const { regular, destructive } = useChannelActions(channel);

  return (
    <>
      {regular.map((action) =>
        'items' in action ? (
          <ContextMenuSub key={action.id}>
            <ContextMenuSubTrigger>
              <action.icon />
              {action.label}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {action.items.map(({ id, label, checked, run }) => (
                <ContextMenuItem key={id} onClick={run}>
                  {label}
                  {checked && <IconCheck className="ml-auto" />}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : (
          <ContextMenuItem key={action.id} onClick={action.run}>
            <action.icon />
            {action.label}
          </ContextMenuItem>
        )
      )}
      {regular.length > 0 && destructive.length > 0 && <ContextMenuSeparator />}
      {destructive.map((action) => (
        <ContextMenuItem
          key={action.id}
          variant="destructive"
          onClick={'run' in action ? action.run : undefined}
        >
          <action.icon />
          {action.label}
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
