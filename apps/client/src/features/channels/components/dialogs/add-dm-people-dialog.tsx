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
import { isDefinedError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useAddDmPeople } from '@/services/channels/hooks';
import { dmsQuery } from '@/services/channels/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { PeoplePicker, type Person } from './people-picker';

/**
 * Adds people to a DM. A DM holds ten, so an eleventh offers to turn it into a private channel,
 * which keeps every message and member and has no limit.
 */
export function AddDmPeopleDialog({ channelId }: { channelId: string }) {
  const { close, open } = useChannelDialogs();
  const addPeople = useAddDmPeople();
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const { data: dms = [] } = useQuery(dmsQuery);
  const [selected, setSelected] = useState<Person[]>([]);
  const [full, setFull] = useState(false);

  const inDm = new Set(
    dms.find((dm) => dm.id === channelId)?.members.map((m) => m.userId)
  );
  const people: Person[] = workspaceMembers
    .filter((member) => member.status === 'active' && !inDm.has(member.userId))
    .map((member) => ({ id: member.userId, name: member.name }));

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>
            A direct message holds up to {DM_MEMBERS_MAX} people.
          </DialogDescription>
        </DialogHeader>
        <PeoplePicker
          people={people}
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            setFull(false);
          }}
          emptyText="No one left to add."
        />
        {full && (
          <p role="alert" className="text-destructive text-sm">
            This direct message is full. Turn it into a private channel to add
            more people. Every message and member stays.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          {full ? (
            <Button
              type="button"
              onClick={() => open({ kind: 'dm-convert', channelId })}
            >
              Turn into a private channel
            </Button>
          ) : (
            <StatusButton
              disabled={!selected.length}
              status={addPeople.isPending ? 'loading' : 'idle'}
              onClick={() =>
                addPeople.mutate(
                  { channelId, userIds: selected.map((person) => person.id) },
                  {
                    onSuccess: close,
                    onError: (error) => {
                      if (isDefinedError(error) && error.code === 'DM_FULL') {
                        setFull(true);
                      } else {
                        toast.error(error.message);
                      }
                    },
                  }
                )
              }
            >
              Add
            </StatusButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
