import { orpc } from '@/lib/orpc';

export const roomQuery = (roomId: string) =>
  orpc.rooms.get.queryOptions({ input: { roomId } });

export const roomMembersQuery = (roomId: string) =>
  orpc.rooms.members.list.queryOptions({ input: { roomId } });
