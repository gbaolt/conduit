'use client';

import { DM_MEMBERS_MAX } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { sessionQuery } from '@/services/auth/queries';
import { useOpenDm } from '@/services/dms/hooks';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import { useDmDialogs } from '../../context/dm-dialogs-provider';
import { PeoplePicker, type Person } from './people-picker';

/** Picks up to nine people and opens the DM with them. Picking no one opens your own notes. */
export function NewDmDialog() {
  const { close } = useDmDialogs();
  const router = useRouter();
  const openDm = useOpenDm();
  const { data: session } = useQuery(sessionQuery);
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const [selected, setSelected] = useState<Person[]>([]);

  const people: Person[] = workspaceMembers.filter(
    (member) => member.status === 'active' && member.userId !== session?.user.id
  );
  const full = selected.length >= DM_MEMBERS_MAX - 1;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>
            Choose up to {DM_MEMBERS_MAX - 1} people. Choose no one to write
            notes to yourself.
          </DialogDescription>
        </DialogHeader>
        <PeoplePicker
          people={people}
          selected={selected}
          onChange={(next) => setSelected(next.slice(0, DM_MEMBERS_MAX - 1))}
          emptyText="No one found."
        />
        {full && (
          <p className="text-muted-foreground text-xs">
            A direct message holds up to {DM_MEMBERS_MAX} people with you.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <StatusButton
            status={openDm.isPending ? 'loading' : 'idle'}
            onClick={() =>
              openDm.mutate(
                { userIds: selected.map((person) => person.userId) },
                {
                  onSuccess: (dm) => {
                    close();
                    router.push(`/dms/${dm.id}`);
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            {selected.length ? 'Open' : 'Open my notes'}
          </StatusButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
