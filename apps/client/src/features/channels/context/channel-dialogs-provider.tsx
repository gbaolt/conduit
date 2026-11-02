'use client';

import type { Channel } from '@conduit/contract';
import { createContext, type ReactNode, use, useMemo, useState } from 'react';

import { BrowseChannelsDialog } from '../components/browse-channels-dialog';
import { CreateChannelDialog } from '../components/create-channel-dialog';
import { DeleteChannelDialog } from '../components/delete-channel-dialog';
import { RenameChannelDialog } from '../components/rename-channel-dialog';

/** Every dialog the channel UI can open. A new dialog adds one member here and one case in `OpenChannelDialog`. */
export type ChannelDialog =
  | { kind: 'create' }
  | { kind: 'browse' }
  | { kind: 'rename'; channel: Channel }
  | { kind: 'delete'; channel: Channel };

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
