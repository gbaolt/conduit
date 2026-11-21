'use client';

import { Button } from '@conduit/ui/components/button';
import { Kbd, KbdGroup } from '@conduit/ui/components/kbd';
import { IconSearch } from '@tabler/icons-react';

import { useCommandMenu } from '../context/command-menu-provider';

/** The Search Conduit bar at the top of the app. It opens the command menu, as Ctrl+K does. */
export function CommandMenu() {
  const { setOpen } = useCommandMenu();

  return (
    <Button
      data-slot="command-menu-trigger"
      variant="outline"
      onClick={() => setOpen(true)}
      className="group text-muted-foreground hover:bg-background hover:text-muted-foreground dark:hover:bg-input/30 h-8 w-full justify-start gap-2 rounded-lg px-3 font-normal shadow-none select-none"
    >
      <IconSearch data-icon="inline-start" />
      <span className="truncate">Search Conduit</span>
      <KbdGroup className="ml-auto max-sm:hidden">
        <Kbd className="group-active:text-foreground">Ctrl</Kbd>
        <Kbd className="group-active:text-foreground w-5 min-w-5">K</Kbd>
      </KbdGroup>
    </Button>
  );
}
