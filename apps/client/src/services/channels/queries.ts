import { orpc } from '@/lib/orpc';

export const channelsQuery = orpc.channels.list.queryOptions();

export const channelQuery = (channelId: string) =>
  orpc.channels.get.queryOptions({ input: { channelId } });

export const channelMembersQuery = (channelId: string) =>
  orpc.channels.members.list.queryOptions({ input: { channelId } });
