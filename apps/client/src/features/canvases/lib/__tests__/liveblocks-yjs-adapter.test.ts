import { describe, expect, it, vi } from 'vitest';

import {
  createLiveblocksYjsAdapter,
  type LiveblocksConnection,
  type LiveblocksYjs,
} from '../liveblocks-yjs-adapter';

function setup({ synced = false } = {}) {
  const syncListeners = new Set<(synced: boolean) => void>();
  const statusListeners = new Set<(status: string) => void>();
  const awareness = { getStates: () => new Map() };
  const yjs: LiveblocksYjs = {
    awareness,
    synced,
    on: (_type, listener) => syncListeners.add(listener),
    off: (_type, listener) => syncListeners.delete(listener),
  };
  let status = 'connected';
  const connection: LiveblocksConnection = {
    getStatus: () => status,
    subscribe: (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  };
  const provider = createLiveblocksYjsAdapter(yjs, connection);
  const onSync = vi.fn();
  const onStatus = vi.fn();
  provider.on('sync', onSync);
  provider.on('status', onStatus);
  return {
    provider,
    awareness,
    onSync,
    onStatus,
    syncListeners,
    statusListeners,
    sync: (value: boolean) => {
      yjs.synced = value;
      for (const listener of syncListeners) listener(value);
    },
    setStatus: (next: string) => {
      status = next;
      for (const listener of statusListeners) listener(next);
    },
  };
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('createLiveblocksYjsAdapter', () => {
  it('passes Liveblocks awareness through untouched', () => {
    const { provider, awareness } = setup();
    expect(provider.awareness).toBe(awareness);
  });

  it('forwards sync events once connected, and not after disconnecting', async () => {
    const { provider, onSync, sync } = setup();
    sync(true);
    expect(onSync).not.toHaveBeenCalled();

    provider.connect();
    await flush();
    expect(onSync).toHaveBeenCalledTimes(1);

    sync(false);
    sync(true);
    expect(onSync.mock.calls).toEqual([[true], [false], [true]]);

    provider.disconnect();
    sync(true);
    expect(onSync).toHaveBeenCalledTimes(3);
  });

  it('announces a sync that finished before Lexical connected, exactly once', async () => {
    const { provider, onSync } = setup({ synced: true });
    provider.connect();
    await flush();
    expect(onSync.mock.calls).toEqual([[true]]);

    const late = setup();
    late.provider.connect();
    late.sync(true);
    await flush();
    expect(late.onSync.mock.calls).toEqual([[true]]);
  });

  it('reports the room status in the shape Lexical reads', async () => {
    const { provider, onStatus, setStatus } = setup();
    provider.connect();
    await flush();
    setStatus('reconnecting');
    expect(onStatus.mock.calls).toEqual([
      [{ status: 'connected' }],
      [{ status: 'reconnecting' }],
    ]);
  });

  it('treats repeated connect and disconnect calls as one', async () => {
    const { provider, onSync, syncListeners, statusListeners } = setup({
      synced: true,
    });
    provider.connect();
    provider.connect();
    await flush();
    expect(syncListeners.size).toBe(1);
    expect(statusListeners.size).toBe(1);
    expect(onSync).toHaveBeenCalledTimes(1);

    provider.disconnect();
    provider.disconnect();
    expect(syncListeners.size).toBe(0);
    expect(statusListeners.size).toBe(0);

    provider.connect();
    await flush();
    expect(syncListeners.size).toBe(1);
    expect(onSync).toHaveBeenCalledTimes(2);
  });

  it('skips the replayed sync when disconnected before it ran', async () => {
    const { provider, onSync } = setup({ synced: true });
    provider.connect();
    provider.disconnect();
    await flush();
    expect(onSync).not.toHaveBeenCalled();
  });
});
