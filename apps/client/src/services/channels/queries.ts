import { orpc } from '@/lib/orpc';

export const channelsQuery = orpc.channels.list.queryOptions();

export const channelSectionsQuery = orpc.channelSections.list.queryOptions();

export const archivedChannelsQuery = orpc.channels.list.queryOptions({
  input: { archived: true },
});
