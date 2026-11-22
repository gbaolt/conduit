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
      size="sm"
      variant="outline"
      onClick={() => setOpen(true)}
      className="group w-full justify-start font-normal active:scale-none!"
    >
      <IconSearch data-icon="inline-start" />
      <span className="text-muted-foreground ml-1 truncate">
        Search Conduit
      </span>
      <KbdGroup
        data-icon="inline-end"
        className="-mr-0.5 ml-auto max-sm:hidden"
      >
        <Kbd className="group-active:text-foreground">Ctrl</Kbd>
        <Kbd className="group-active:text-foreground w-5 min-w-5">K</Kbd>
      </KbdGroup>
    </Button>
  );
}
