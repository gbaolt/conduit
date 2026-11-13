'use client';

import {
  activeTypers,
  createComposerActivity,
  createTrailingWriter,
  HEARTBEAT_INTERVAL_MS,
  PresenceRowSchema,
  presenceStatus,
  READ_DEBOUNCE_MS,
  READ_MIN_INTERVAL_MS,
  type SidebarEntry,
  SidebarEntrySchema,
  type TypingRow,
  TypingRowSchema,
} from '@conduit/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { client, orpc } from '@/lib/orpc';
import { useLiveRows } from '@/services/messages/live';

import {
  draftQuery,
  isUnread,
  presenceQuery,
  sidebarStateQuery,
} from './queries';

const ignore = () => undefined;

const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/**
 * Opens the `sidebar` stream and keeps its rows in the cache. When the set of conversations changes
 * after the first result, such as someone adding the viewer to a channel or a DM, the channel and DM lists
 * refetch. Mount it once per workspace.
 */
export function useSidebarStream() {
  const queryClient = useQueryClient();
  const known = useRef<ReadonlySet<string> | null>(null);

  return useLiveRows({ kind: 'sidebar' }, SidebarEntrySchema, (rows) => {
    queryClient.setQueryData(sidebarStateQuery.queryKey, rows);

    const ids = new Set(rows.map((row) => row.roomId));
    if (known.current && !sameIds(known.current, ids)) {
      void queryClient.invalidateQueries({ queryKey: orpc.channels.key() });
      void queryClient.invalidateQueries({ queryKey: orpc.rooms.key() });
      void queryClient.invalidateQueries({ queryKey: orpc.dms.key() });
    }
    known.current = ids;
  });
}

/** The viewer's sidebar row for a conversation, or undefined until the stream delivers it. */
export function useSidebarEntry(roomId: string): SidebarEntry | undefined {
  return useQuery({
    ...sidebarStateQuery,
    select: (rows) => rows.find((row) => row.roomId === roomId),
  }).data;
}

/** Whether a conversation, a channel or a DM, has messages the viewer has not read. */
export function useIsUnread(roomId: string) {
  return (
    useQuery({
      ...sidebarStateQuery,
      select: (rows) => isUnread(rows.find((row) => row.roomId === roomId)),
    }).data ?? false
  );
}

/** Whether the viewer has muted a conversation, a channel or a DM. */
export function useIsMuted(roomId: string) {
  return (
    useQuery({
      ...sidebarStateQuery,
      select: (rows) => !!rows.find((row) => row.roomId === roomId)?.mutedAt,
    }).data ?? false
  );
}

/** Whether the viewer has an unsent message in a conversation, a channel or a DM. */
export function useHasDraft(roomId: string) {
  return (
    useQuery({
      ...sidebarStateQuery,
      select: (rows) =>
        rows.find((row) => row.roomId === roomId)?.hasDraft ?? false,
    }).data ?? false
  );
}

/**
 * Records how far the viewer has read, at most once every few seconds. Push the newest message the viewer
 * has seen. The write for a conversation the viewer leaves goes out when the component unmounts.
 */
export function useMarkRead(roomId: string) {
  const writer = useMemo(
    () =>
      createTrailingWriter(
        (messageId: string) =>
          void client.readState.mark({ roomId, messageId }).catch(ignore),
        { debounceMs: READ_DEBOUNCE_MS, minIntervalMs: READ_MIN_INTERVAL_MS }
      ),
    [roomId]
  );

  useEffect(() => () => writer.flush(), [writer]);

  return writer.push;
}

/**
 * The viewer's saved draft for a conversation, or for one thread of it. Undefined while it loads.
 * It is read once, because the composer takes it as its starting text and must not restart on a refetch.
 */
export function useDraft(roomId: string, parentId?: string) {
  const { data, isError } = useQuery(draftQuery(roomId, parentId));
  // A draft that fails to load starts the composer empty.
  const loaded = data?.body ?? (isError ? '' : undefined);
  const [initial, setInitial] = useState(loaded);

  if (initial === undefined && loaded !== undefined) setInitial(loaded);

  return initial;
}

/**
 * What a composer does as the viewer types: saves the draft, and tells the conversation they are typing.
 * Returns the function to call with the composer's Markdown after each change. `saved` is the draft the
 * composer started from, so loading it does not count as a change.
 */
export function useComposerActivity(
  roomId: string,
  saved: string,
  parentId?: string
) {
  const activity = useMemo(
    () =>
      createComposerActivity({
        saved,
        saveDraft: (body) =>
          void client.drafts.save({ roomId, parentId, body }).catch(ignore),
        ping: () => void client.typing.ping({ roomId, parentId }).catch(ignore),
      }),
    [roomId, parentId, saved]
  );

  useEffect(() => () => activity.flush(), [activity]);

  return activity.change;
}

type TypingSnapshot = { rows: TypingRow[]; now: number };

/**
 * The user ids typing in a conversation now, other than the viewer. Rows past their `until` drop out on a
 * 1 s timer that runs only while someone is typing. Pass a thread's `parentId` for that thread.
 */
export function useTypers(roomId: string, parentId = '') {
  const [snapshot, setSnapshot] = useState<TypingSnapshot>({
    rows: [],
    now: 0,
  });

  useLiveRows({ kind: 'typing', roomId }, TypingRowSchema, (rows) =>
    setSnapshot({ rows, now: Date.now() })
  );

  const typers = useMemo(
    () =>
      activeTypers(
        snapshot.rows.filter((row) => row.parentId === parentId),
        snapshot.now
      ).map((row) => row.userId),
    [snapshot, parentId]
  );
  const anyone = typers.length > 0;

  useEffect(() => {
    if (!anyone) return;
    const timer = setInterval(
      () => setSnapshot((current) => ({ ...current, now: Date.now() })),
      1000
    );
    return () => clearInterval(timer);
  }, [anyone]);

  return typers;
}

/** Opens the `presence` stream and keeps its rows in the cache. Mount it once per workspace. */
export function usePresenceStream() {
  const queryClient = useQueryClient();

  return useLiveRows({ kind: 'presence' }, PresenceRowSchema, (rows) =>
    queryClient.setQueryData(presenceQuery.queryKey, rows)
  );
}

/**
 * Tells the workspace the viewer is here: a heartbeat every minute while the tab is in front,
 * and one with `away` when it is hidden. Mount it once per workspace.
 */
export function useHeartbeat() {
  useEffect(() => {
    const beat = (away: boolean) =>
      void client.presence.heartbeat({ away }).catch(ignore);
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      beat(false);
      timer = setInterval(() => beat(false), HEARTBEAT_INTERVAL_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      stop();
      if (document.visibilityState === 'visible') start();
      else beat(true);
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, []);
}

// Re-reads the clock, so a member whose heartbeat stops turns away without a new event.
const CLOCK_TICK_MS = 15_000;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/** Whether a member is online or away. A DM reads the other member's status with their user id. */
export function usePresenceStatus(userId: string) {
  const row = useQuery({
    ...presenceQuery,
    select: (rows) => rows.find((entry) => entry.userId === userId),
  }).data;

  const now = useNow(CLOCK_TICK_MS);

  return presenceStatus(row, now);
}
