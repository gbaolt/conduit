'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { CreateChannelForm } from '../forms/create-channel-form';

export function CreateChannelDialog() {
  const { close } = useChannelDialogs();

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where your team talks about a topic.
          </DialogDescription>
        </DialogHeader>
        <CreateChannelForm onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
