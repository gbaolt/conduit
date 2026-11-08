'use client';

import type { Room } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@conduit/ui/components/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useAddChannelMembers } from '@/services/channels/hooks';
import { roomMembersQuery } from '@/services/channels/queries';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';

type Person = { id: string; name: string };

export function AddMembersDialog({ channel }: { channel: Room }) {
  const { close } = useChannelDialogs();
  const anchor = useComboboxAnchor();
  const addMembers = useAddChannelMembers();
  const { data: workspaceMembers = [] } = useWorkspaceMembers();
  const { data: channelMembers = [] } = useQuery(roomMembersQuery(channel.id));
  const [selected, setSelected] = useState<Person[]>([]);

  const inChannel = new Set(channelMembers.map((member) => member.userId));
  const people: Person[] = workspaceMembers
    .filter(
      (member) => member.status === 'active' && !inChannel.has(member.userId)
    )
    .map((member) => ({ id: member.userId, name: member.name }));

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add people to #{channel.name}</DialogTitle>
        </DialogHeader>
        <Combobox
          multiple
          autoHighlight
          items={people}
          value={selected}
          onValueChange={setSelected}
          itemToStringLabel={(person: Person) => person.name}
          isItemEqualToValue={(a: Person, b: Person) => a.id === b.id}
        >
          <ComboboxChips ref={anchor}>
            <ComboboxValue>
              {(values: Person[]) => (
                <>
                  {values.map((person) => (
                    <ComboboxChip key={person.id}>{person.name}</ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    autoFocus
                    aria-label="Search people"
                    placeholder={selected.length ? '' : 'Search people'}
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>No one left to add.</ComboboxEmpty>
            <ComboboxList>
              {(person: Person) => (
                <ComboboxItem key={person.id} value={person}>
                  {person.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <StatusButton
            disabled={!selected.length}
            status={addMembers.isPending ? 'loading' : 'idle'}
            onClick={() =>
              addMembers.mutate(
                {
                  roomId: channel.id,
                  userIds: selected.map((person) => person.id),
                },
                {
                  onSuccess: close,
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            Add
          </StatusButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
