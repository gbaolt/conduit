import {
  canChannel,
  type Channel,
  type ChannelAction,
  type WorkspaceRole,
} from '@conduit/contract';
import {
  IconCopy,
  IconInfoCircle,
  IconLink,
  IconLogout,
  IconPencil,
  IconTrash,
  IconUserPlus,
  type TablerIcon,
} from '@tabler/icons-react';
import { toast } from 'sonner';

import type { ChannelDialog } from '../context/channel-dialogs-provider';

/** What a row needs from the app to run: the dialog host and the mutations a dialog does not own. */
export type ChannelActionContext = {
  open: (dialog: ChannelDialog) => void;
  leave: (channel: Channel) => void;
};

export type ChannelMenuAction = {
  id: string;
  label: string;
  icon: TablerIcon;
  destructive: boolean;
  run: (context: ChannelActionContext) => void;
};

type Row = Pick<ChannelMenuAction, 'id' | 'label' | 'icon'> & {
  destructive?: true;
  /** The policy action that gates the row. Omit it for rows anyone who sees the channel can use. */
  policy?: ChannelAction;
  run: (channel: Channel, context: ChannelActionContext) => void;
};

export function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied'),
    () => toast.error('Could not copy')
  );
}

// The one table behind the dropdown and the context menu. Later PRs add rows here.
const rows: Row[] = [
  {
    id: 'copy-name',
    label: 'Copy name',
    icon: IconCopy,
    run: (channel) => copy(`#${channel.name}`),
  },
  {
    id: 'copy-link',
    label: 'Copy link',
    icon: IconLink,
    run: (channel) => copy(`${location.origin}/channels/${channel.id}`),
  },
  {
    id: 'rename',
    label: 'Rename',
    icon: IconPencil,
    policy: 'rename',
    run: (channel, { open }) => open({ kind: 'rename', channel }),
  },
  {
    id: 'leave',
    label: 'Leave channel',
    icon: IconLogout,
    destructive: true,
    policy: 'leave',
    run: (channel, { leave }) => leave(channel),
  },
  {
    id: 'delete',
    label: 'Delete channel',
    icon: IconTrash,
    destructive: true,
    policy: 'delete',
    run: (channel, { open }) => open({ kind: 'delete', channel }),
  },
  {
    id: 'details',
    label: 'View details',
    icon: IconInfoCircle,
    run: (channel, { open }) => open({ kind: 'details', channel }),
  },
  {
    id: 'add-members',
    label: 'Add people',
    icon: IconUserPlus,
    policy: 'addMembers',
    run: (channel, { open }) => open({ kind: 'add-members', channel }),
  },
];

/** The rows the viewer may use on this channel, so the menu hides what the server refuses. */
export function getChannelActions(
  channel: Channel,
  viewer: { workspaceRole: WorkspaceRole }
): ChannelMenuAction[] {
  return rows
    .filter(
      (row) =>
        !row.policy || canChannel(row.policy, viewer.workspaceRole, channel)
    )
    .map((row) => ({
      id: row.id,
      label: row.label,
      icon: row.icon,
      destructive: row.destructive ?? false,
      run: (context) => row.run(channel, context),
    }));
}
