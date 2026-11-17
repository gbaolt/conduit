'use client';

import type { ChannelSection, Room } from '@conduit/contract';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';

import { useChannelDialogs } from '../../context/channel-dialogs-provider';
import { SectionNameForm } from '../forms/section-name-form';

export function SectionNameDialog({
  section,
  channel,
}: {
  section?: ChannelSection;
  channel?: Room;
}) {
  const { close } = useChannelDialogs();

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {section ? 'Rename section' : 'New section'}
          </DialogTitle>
        </DialogHeader>
        <SectionNameForm section={section} channel={channel} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
