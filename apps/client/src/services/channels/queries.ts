import { orpc } from '@/lib/orpc';

export const channelsQuery = orpc.channels.list.queryOptions();

export const channelQuery = (channelId: string) =>
  orpc.channels.get.queryOptions({ input: { channelId } });

export const channelSectionsQuery = orpc.channelSections.list.queryOptions();

export const channelMembersQuery = (channelId: string) =>
  orpc.channels.members.list.queryOptions({ input: { channelId } });

export const archivedChannelsQuery = orpc.channels.list.queryOptions({
  input: { archived: true },
});

export const dmsQuery = orpc.dms.list.queryOptions();
