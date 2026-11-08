'use client';

import { createContext, type ReactNode, use, useMemo, useState } from 'react';

import { AddDmPeopleDialog } from '../components/dialogs/add-dm-people-dialog';
import { ConvertDmDialog } from '../components/dialogs/convert-dm-dialog';
import { NewDmDialog } from '../components/dialogs/new-dm-dialog';

/** Every dialog the DM UI can open. A new dialog adds one member here and one case in `OpenDmDialog`. */
export type DmDialog =
  | { kind: 'new-dm' }
  | { kind: 'dm-add-people'; roomId: string }
  | { kind: 'dm-convert'; roomId: string };

type DmDialogsValue = {
  open: (dialog: DmDialog) => void;
  close: () => void;
};

const DmDialogsContext = createContext<DmDialogsValue | null>(null);

function OpenDmDialog({ dialog }: { dialog: DmDialog }) {
  switch (dialog.kind) {
    case 'new-dm':
      return <NewDmDialog />;
    case 'dm-add-people':
      return <AddDmPeopleDialog roomId={dialog.roomId} />;
    case 'dm-convert':
      return <ConvertDmDialog roomId={dialog.roomId} />;
  }
}

export function DmDialogsProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DmDialog | null>(null);
  const value = useMemo<DmDialogsValue>(
    () => ({ open: setDialog, close: () => setDialog(null) }),
    []
  );

  return (
    <DmDialogsContext.Provider value={value}>
      {children}
      {dialog && <OpenDmDialog dialog={dialog} />}
    </DmDialogsContext.Provider>
  );
}

export function useDmDialogs() {
  const context = use(DmDialogsContext);

  if (!context) {
    throw new Error('useDmDialogs must be used within DmDialogsProvider');
  }

  return context;
}
