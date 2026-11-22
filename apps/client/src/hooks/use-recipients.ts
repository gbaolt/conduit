'use client';

import { canChannel } from '@conduit/contract';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { recipientsOf } from '@/lib/recipients';
import { sidebarStateQuery } from '@/services/activity/queries';
import { sessionQuery } from '@/services/auth/queries';
import { channelsQuery } from '@/services/channels/queries';
import { dmsQuery } from '@/services/dms/queries';
import {
  useWorkspaceMembers,
  useWorkspaceRole,
} from '@/services/workspaces/hooks';

/** Where the viewer can send a message: channels they may post in, every active person, and each group DM. */
export function useRecipients() {
  const workspaceRole = useWorkspaceRole();
  const { data: session } = useQuery(sessionQuery);
  const { data: channels = [] } = useQuery(channelsQuery);
  const { data: dms = [] } = useQuery(dmsQuery);
  const { data: entries = [] } = useQuery(sidebarStateQuery);
  const { data: members = [] } = useWorkspaceMembers();
  const viewerId = session?.user.id ?? '';

  const recipients = useMemo(
    () =>
      recipientsOf({
        channels: channels.filter(
          (room) =>
            room.membership && canChannel('sendMessage', workspaceRole, room)
        ),
        dms,
        people: members.filter((member) => member.status === 'active'),
        entries,
        viewerId,
      }),
    [channels, dms, members, entries, viewerId, workspaceRole]
  );

  return { recipients, dms, viewerId };
}
