'use client';

import {
  createTrailingWriter,
  READ_DEBOUNCE_MS,
  READ_MIN_INTERVAL_MS,
  type SidebarEntry,
  SidebarEntrySchema,
} from '@conduit/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { client, orpc } from '@/lib/orpc';
import { useLiveRows } from '@/services/messages/live';

import { isUnread, sidebarStateQuery } from './queries';

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/**
 * Opens the `sidebar` stream and keeps its rows in the cache. When the set of conversations changes
 * after the first result, such as someone adding the viewer to a channel or a DM, the channel list refetches.
 * Mount it once per workspace.
 */
export function useSidebarStream() {
  const queryClient = useQueryClient();
  const known = useRef<ReadonlySet<string> | null>(null);

  return useLiveRows({ kind: 'sidebar' }, SidebarEntrySchema, (rows) => {
    queryClient.setQueryData(sidebarStateQuery.queryKey, rows);

    const ids = new Set(rows.map((row) => row.channelId));
    if (known.current && !sameIds(known.current, ids)) {
      void queryClient.invalidateQueries({ queryKey: orpc.channels.key() });
    }
    known.current = ids;
  });
}

/** The viewer's sidebar row for a conversation, or undefined until the stream delivers it. */
export function useSidebarEntry(channelId: string): SidebarEntry | undefined {
  return useQuery({
    ...sidebarStateQuery,
    select: (rows) => rows.find((row) => row.channelId === channelId),
  }).data;
}

/** Whether a conversation, a channel or a DM, has messages the viewer has not read. */
export function useIsUnread(channelId: string) {
  return (
    useQuery({
      ...sidebarStateQuery,
      select: (rows) =>
        isUnread(rows.find((row) => row.channelId === channelId)),
    }).data ?? false
  );
}

/**
 * Records how far the viewer has read, at most once every few seconds. Push the newest message the viewer
 * has seen. The write for a conversation the viewer leaves goes out when the component unmounts.
 */
export function useMarkRead(channelId: string) {
  const writer = useMemo(
    () =>
      createTrailingWriter(
        (messageId: string) =>
          void client.readState
            .mark({ channelId, messageId })
            .catch(() => undefined),
        { debounceMs: READ_DEBOUNCE_MS, minIntervalMs: READ_MIN_INTERVAL_MS }
      ),
    [channelId]
  );

  useEffect(() => () => writer.flush(), [writer]);

  return writer.push;
}
