'use client';

import dynamic from 'next/dynamic';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useEffect,
  useMemo,
  useState,
} from 'react';

const CommandMenuDialog = dynamic(
  () =>
    import('../components/command-menu-dialog').then(
      (mod) => mod.CommandMenuDialog
    ),
  { ssr: false }
);

type CommandMenuValue = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
};

const CommandMenuContext = createContext<CommandMenuValue | null>(null);

export function useCommandMenu() {
  const context = use(CommandMenuContext);
  if (!context) {
    throw new Error('useCommandMenu must be used inside CommandMenuProvider');
  }
  return context;
}

/** Owns whether the command menu is open, toggles it on Ctrl+K or ⌘K, and loads the dialog the first time it opens. */
export function CommandMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  if (open && !hasOpened) setHasOpened(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'k' ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      setOpen((wasOpen) => !wasOpen);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <CommandMenuContext value={value}>
      {children}
      {hasOpened && <CommandMenuDialog />}
    </CommandMenuContext>
  );
}
