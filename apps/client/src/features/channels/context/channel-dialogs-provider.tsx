'use client';

import type { Channel, ChannelSection } from '@conduit/contract';
import { createContext, type ReactNode, use, useMemo, useState } from 'react';

import { AddDmPeopleDialog } from '../components/add-dm-people-dialog';
import { AddMembersDialog } from '../components/add-members-dialog';
import { ArchiveChannelDialog } from '../components/archive-channel-dialog';
import { BrowseChannelsDialog } from '../components/browse-channels-dialog';
import { ChangeVisibilityDialog } from '../components/change-visibility-dialog';
import { ChannelDetailsDialog } from '../components/channel-details-dialog';
import { ConvertDmDialog } from '../components/convert-dm-dialog';
import { CreateChannelDialog } from '../components/create-channel-dialog';
import { DeleteChannelDialog } from '../components/delete-channel-dialog';
import { NewDmDialog } from '../components/new-dm-dialog';
import { RenameChannelDialog } from '../components/rename-channel-dialog';
import { SectionNameDialog } from '../components/section-name-dialog';

/** Every dialog the channel UI can open. A new dialog adds one member here and one case in `OpenChannelDialog`. */
export type ChannelDialog =
  | { kind: 'create' }
  | { kind: 'browse' }
  | { kind: 'rename'; channel: Channel }
  | { kind: 'delete'; channel: Channel }
  | { kind: 'details'; channel: Channel; tab?: 'about' | 'members' }
  | { kind: 'add-members'; channel: Channel }
  /** Archives an active channel and unarchives an archived one. */
  | { kind: 'archive'; channel: Channel }
  | { kind: 'visibility'; channel: Channel }
  | { kind: 'new-dm' }
  | { kind: 'dm-add-people'; channelId: string }
  | { kind: 'dm-convert'; channelId: string }
  /** Renames `section`, or creates one (and moves `channel` into it) when there is no `section`. */
  | { kind: 'section-name'; section?: ChannelSection; channel?: Channel };

type ChannelDialogsValue = {
  open: (dialog: ChannelDialog) => void;
  close: () => void;
};

const ChannelDialogsContext = createContext<ChannelDialogsValue | null>(null);

function OpenChannelDialog({ dialog }: { dialog: ChannelDialog }) {
  switch (dialog.kind) {
    case 'create':
      return <CreateChannelDialog />;
    case 'browse':
      return <BrowseChannelsDialog />;
    case 'rename':
      return <RenameChannelDialog channel={dialog.channel} />;
    case 'delete':
      return <DeleteChannelDialog channel={dialog.channel} />;
    case 'details':
      return <ChannelDetailsDialog channel={dialog.channel} tab={dialog.tab} />;
    case 'add-members':
      return <AddMembersDialog channel={dialog.channel} />;
    case 'archive':
      return <ArchiveChannelDialog channel={dialog.channel} />;
    case 'visibility':
      return <ChangeVisibilityDialog channel={dialog.channel} />;
    case 'new-dm':
      return <NewDmDialog />;
    case 'dm-add-people':
      return <AddDmPeopleDialog channelId={dialog.channelId} />;
    case 'dm-convert':
      return <ConvertDmDialog channelId={dialog.channelId} />;
    case 'section-name':
      return (
        <SectionNameDialog section={dialog.section} channel={dialog.channel} />
      );
  }
}

export function ChannelDialogsProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ChannelDialog | null>(null);
  const value = useMemo<ChannelDialogsValue>(
    () => ({ open: setDialog, close: () => setDialog(null) }),
    []
  );

  return (
    <ChannelDialogsContext.Provider value={value}>
      {children}
      {dialog && <OpenChannelDialog dialog={dialog} />}
    </ChannelDialogsContext.Provider>
  );
}

export function useChannelDialogs() {
  const context = use(ChannelDialogsContext);

  if (!context) {
    throw new Error(
      'useChannelDialogs must be used within ChannelDialogsProvider'
    );
  }

  return context;
}
