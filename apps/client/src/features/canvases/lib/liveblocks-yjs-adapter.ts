import type { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import type { ComponentProps } from 'react';

// `@lexical/yjs` is not a direct dependency, so its `Provider` type is read off the plugin that takes one.
type Provider = ReturnType<
  ComponentProps<typeof CollaborationPlugin>['providerFactory']
>;

/** The parts of `LiveblocksYjsProvider` the adapter reads. */
export type LiveblocksYjs = {
  awareness: unknown;
  synced: boolean;
  on(type: 'sync', listener: (synced: boolean) => void): void;
  off(type: 'sync', listener: (synced: boolean) => void): void;
};

/** The room's connection status, as `room.getStatus()` and `room.subscribe('status')` report it. */
export type LiveblocksConnection = {
  getStatus(): string;
  subscribe(listener: (status: string) => void): () => void;
};

type ProviderEvent = 'sync' | 'status' | 'update' | 'reload';

/**
 * Wraps Liveblocks' Yjs provider in the `Provider` that `@lexical/yjs` expects, without
 * `@liveblocks/react-lexical`, which pins an older Lexical.
 *
 * Liveblocks syncs on its own, so `connect` and `disconnect` only start and stop forwarding its events.
 * Both are safe to call any number of times, as React's strict mode does.
 */
export function createLiveblocksYjsAdapter(
  yjs: LiveblocksYjs,
  connection: LiveblocksConnection
): Provider {
  const listeners = new Map<ProviderEvent, Set<(arg: never) => void>>();
  const emit = (type: ProviderEvent, arg: unknown) => {
    for (const listener of listeners.get(type) ?? []) listener(arg as never);
  };
  let announced = false;
  const onSync = (synced: boolean) => {
    announced = true;
    emit('sync', synced);
  };
  // Lexical reads `{ status }` and treats only 'connected' as online, which matches Liveblocks' names.
  const onStatus = (status: string) => emit('status', { status });
  let stop: (() => void) | null = null;

  return {
    awareness: yjs.awareness as Provider['awareness'],
    connect() {
      if (stop) return;
      yjs.on('sync', onSync);
      const unsubscribe = connection.subscribe(onStatus);
      stop = () => {
        yjs.off('sync', onSync);
        unsubscribe();
      };
      // Liveblocks may have synced before Lexical listened, and would never say so again.
      queueMicrotask(() => {
        if (!stop) return;
        onStatus(connection.getStatus());
        if (yjs.synced && !announced) onSync(true);
      });
    },
    disconnect() {
      stop?.();
      stop = null;
      announced = false;
    },
    on(type: ProviderEvent, listener: (arg: never) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    off(type: ProviderEvent, listener: (arg: never) => void) {
      listeners.get(type)?.delete(listener);
    },
  } as Provider;
}
