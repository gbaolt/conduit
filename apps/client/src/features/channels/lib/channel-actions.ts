import {
  canChannel,
  type Channel,
  type ChannelAction,
  type ChannelSection,
  type WorkspaceRole,
} from '@conduit/contract';
import {
  IconArchive,
  IconArchiveOff,
  IconCopy,
  IconFolder,
  IconHash,
  IconInfoCircle,
  IconLink,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconPlus,
  IconUserPlus,
  type TablerIcon,
} from '@tabler/icons-react';
import { toast } from 'sonner';

import type { ChannelDialog } from '../context/channel-dialogs-provider';

/** What a row needs from the app to run: the dialog host and the mutations a dialog does not own. */
export type ChannelActionContext = {
  open: (dialog: ChannelDialog) => void;
  leave: (channel: Channel) => void;
  setStarred: (channel: Channel, starred: boolean) => void;
  moveToSection: (channel: Channel, sectionId: string | null) => void;
};

/** One entry of a submenu row. */
export type ChannelMenuItem = {
  id: string;
  label: string;
  icon: TablerIcon;
  checked: boolean;
  run: (context: ChannelActionContext) => void;
};

/** A submenu that groups related rows; rows without one sit at the top level. */
export type ChannelSubmenu = 'details' | 'copy';

/** The menu's separated groups, top to bottom. `danger` rows render as destructive. */
export type ChannelMenuGroup = 'main' | 'organize' | 'danger';

export type ChannelMenuAction = {
  id: string;
  label: string;
  /** Shown on rows inside a submenu. */
  icon?: TablerIcon;
  group: ChannelMenuGroup;
  submenu: ChannelSubmenu | null;
} & (
  | { run: (context: ChannelActionContext) => void }
  | { items: ChannelMenuItem[] }
);

type Row = Pick<ChannelMenuAction, 'id' | 'label' | 'icon'> & {
  /** Defaults to `main`. */
  group?: Exclude<ChannelMenuGroup, 'main'>;
  submenu?: ChannelSubmenu;
  /** The policy action that gates the row. Omit it for rows anyone who sees the channel can use. */
  policy?: ChannelAction;
  /** Hides the row for channels it does not apply to. */
  when?: (channel: Channel) => boolean;
} & (
    | { run: (channel: Channel, context: ChannelActionContext) => void }
    | {
        items: (
          channel: Channel,
          sections: ChannelSection[]
        ) => ChannelMenuItem[];
      }
  );

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
    icon: IconCopy,
    submenu: 'copy',
    label: 'Copy name',
    run: (channel) => copy(`#${channel.name}`),
  },
  {
    id: 'copy-link',
    icon: IconLink,
    submenu: 'copy',
    label: 'Copy link',
    run: (channel) => copy(`${location.origin}/channels/${channel.id}`),
  },
  {
    id: 'details',
    icon: IconInfoCircle,
    submenu: 'details',
    label: 'View details',
    run: (channel, { open }) => open({ kind: 'details', channel }),
  },
  {
    id: 'rename',
    icon: IconPencil,
    submenu: 'details',
    label: 'Rename',
    policy: 'rename',
    run: (channel, { open }) => open({ kind: 'rename', channel }),
  },
  {
    id: 'leave',
    label: 'Leave channel',
    group: 'danger',
    policy: 'leave',
    run: (channel, { leave }) => leave(channel),
  },
  {
    id: 'delete',
    label: 'Delete channel',
    group: 'danger',
    policy: 'delete',
    run: (channel, { open }) => open({ kind: 'delete', channel }),
  },
  {
    id: 'add-members',
    icon: IconUserPlus,
    submenu: 'details',
    label: 'Add people',
    policy: 'addMembers',
    run: (channel, { open }) => open({ kind: 'add-members', channel }),
  },
  {
    id: 'archive',
    icon: IconArchive,
    submenu: 'details',
    label: 'Archive channel',
    policy: 'archive',
    run: (channel, { open }) => open({ kind: 'archive', channel }),
  },
  {
    id: 'unarchive',
    icon: IconArchiveOff,
    submenu: 'details',
    label: 'Unarchive channel',
    policy: 'unarchive',
    run: (channel, { open }) => open({ kind: 'archive', channel }),
  },
  {
    id: 'make-private',
    icon: IconLock,
    submenu: 'details',
    label: 'Change to private',
    policy: 'makePrivate',
    run: (channel, { open }) => open({ kind: 'visibility', channel }),
  },
  {
    id: 'make-public',
    icon: IconLockOpen,
    submenu: 'details',
    label: 'Change to public',
    policy: 'makePublic',
    run: (channel, { open }) => open({ kind: 'visibility', channel }),
  },
  {
    id: 'star',
    label: 'Star channel',
    policy: 'star',
    when: (channel) => !channel.membership?.starredAt,
    run: (channel, { setStarred }) => setStarred(channel, true),
  },
  {
    id: 'unstar',
    label: 'Unstar channel',
    policy: 'star',
    when: (channel) => !!channel.membership?.starredAt,
    run: (channel, { setStarred }) => setStarred(channel, false),
  },
  {
    id: 'move-to',
    group: 'organize',
    label: 'Move to',
    policy: 'moveToSection',
    items: (channel, sections) => {
      const current = channel.membership?.sectionId ?? null;
      return [
        {
          id: 'channels',
          label: 'Channels',
          icon: IconHash,
          checked: current === null,
          run: ({ moveToSection }) => moveToSection(channel, null),
        },
        ...sections.map((section) => ({
          id: section.id,
          label: section.name,
          icon: IconFolder,
          checked: current === section.id,
          run: ({ moveToSection }: ChannelActionContext) =>
            moveToSection(channel, section.id),
        })),
        {
          id: 'new-section',
          label: 'New section',
          icon: IconPlus,
          checked: false,
          run: ({ open }) => open({ kind: 'section-name', channel }),
        },
      ];
    },
  },
];

/** The rows the viewer may use on this channel, so the menu hides what the server refuses. */
export function getChannelActions(
  channel: Channel,
  viewer: { workspaceRole: WorkspaceRole; sections?: ChannelSection[] }
): ChannelMenuAction[] {
  return rows
    .filter(
      (row) =>
        (!row.when || row.when(channel)) &&
        (!row.policy || canChannel(row.policy, viewer.workspaceRole, channel))
    )
    .map((row) => {
      const base = {
        id: row.id,
        label: row.label,
        icon: row.icon,
        group: row.group ?? ('main' as const),
        submenu: row.submenu ?? null,
      };
      return 'items' in row
        ? { ...base, items: row.items(channel, viewer.sections ?? []) }
        : { ...base, run: (context) => row.run(channel, context) };
    });
}
