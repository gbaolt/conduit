import { orpc } from '@/lib/orpc';

export const channelsQuery = orpc.channels.list.queryOptions();

export const channelQuery = (channelId: string) =>
  orpc.channels.get.queryOptions({ input: { channelId } });
