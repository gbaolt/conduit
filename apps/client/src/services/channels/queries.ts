import { orpc } from '@/lib/orpc';

export const channelsQuery = orpc.channels.list.queryOptions();

export const roomQuery = (roomId: string) =>
  orpc.rooms.get.queryOptions({ input: { roomId } });

export const channelSectionsQuery = orpc.channelSections.list.queryOptions();

export const roomMembersQuery = (roomId: string) =>
  orpc.rooms.members.list.queryOptions({ input: { roomId } });

export const archivedChannelsQuery = orpc.channels.list.queryOptions({
  input: { archived: true },
});

export const dmsQuery = orpc.dms.list.queryOptions();
