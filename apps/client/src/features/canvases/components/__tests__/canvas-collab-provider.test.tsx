import type { CanvasLiveblocksAuth } from '@conduit/contract';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { liveblocksAuthMock } = vi.hoisted(() => ({
  liveblocksAuthMock: vi.fn<() => Promise<CanvasLiveblocksAuth>>(),
}));

vi.mock('@/lib/orpc', () => ({
  client: {
    canvases: {
      liveblocksAuth: liveblocksAuthMock,
    },
  },
  orpc: {
    canvases: {
      liveblocksAuth: {
        key: ({ input }: { input: { canvasId: string } }) =>
          ['canvases', 'liveblocksAuth', input] as const,
      },
    },
  },
}));

import { canvasLiveblocksAuthQuery } from '@/services/canvases/queries';

import {
  CanvasCollabProvider,
  type CanvasLiveblocksAuthState,
} from '../canvas-collab-provider';

const liveAuth = (token: string): CanvasLiveblocksAuth => ({
  enabled: true,
  token,
  roomId: 'canvas:c1',
  color: '#3b82f6',
});

function findElement(
  node: ReactNode,
  predicate: (
    el: ReactElement<{ children?: ReactNode; onClick?: () => void }>
  ) => boolean
): ReactElement<{ children?: ReactNode; onClick?: () => void }> | null {
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) {
    return null;
  }
  if (predicate(node)) return node;
  const children = node.props.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  return findElement(children, predicate);
}

async function waitForObserver<TResult>(
  observer: {
    getCurrentResult: () => TResult;
    subscribe: (listener: (result: TResult) => void) => () => void;
  },
  predicate: (result: TResult) => boolean
) {
  const current = observer.getCurrentResult();
  if (predicate(current)) return current;
  return new Promise<TResult>((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (predicate(result)) {
        unsubscribe();
        resolve(result);
      }
    });
  });
}

describe('canvasLiveblocksAuthQuery + CanvasCollabProvider', () => {
  beforeEach(() => {
    liveblocksAuthMock.mockReset();
  });

  it('issues a fresh auth request on immediate reopen with a new openingId instead of reusing a previous token', async () => {
    const queryClient = new QueryClient();
    liveblocksAuthMock
      .mockResolvedValueOnce(liveAuth('revoked-token'))
      .mockResolvedValueOnce(liveAuth('fresh-token'));

    const firstOptions = canvasLiveblocksAuthQuery('c1', 'opening-1');
    expect(firstOptions.staleTime).toBe(0);
    expect(firstOptions.gcTime).toBe(0);
    expect(firstOptions.retry).toBe(false);
    expect(firstOptions.refetchOnMount).toBe(false);
    expect(firstOptions.refetchOnWindowFocus).toBe(false);
    expect(firstOptions.refetchOnReconnect).toBe(false);

    const firstObserver = new QueryObserver(queryClient, firstOptions);
    const firstUnsub = firstObserver.subscribe(() => {});
    const firstResult = await waitForObserver(
      firstObserver,
      (r) => !r.isPending
    );
    expect(firstResult.data).toEqual(liveAuth('revoked-token'));
    expect(liveblocksAuthMock).toHaveBeenCalledTimes(1);

    // Unmount and immediately reopen the same canvas with a new openingId before any GC timer fires.
    firstUnsub();
    firstObserver.destroy();

    const secondOptions = canvasLiveblocksAuthQuery('c1', 'opening-2');
    expect(secondOptions.queryKey).not.toEqual(firstOptions.queryKey);

    const secondObserver = new QueryObserver(queryClient, secondOptions);
    const secondUnsub = secondObserver.subscribe(() => {});
    const secondResult = await waitForObserver(
      secondObserver,
      (r) => !r.isPending
    );

    expect(liveblocksAuthMock).toHaveBeenCalledTimes(2);
    expect(secondResult.data).toEqual(liveAuth('fresh-token'));

    secondUnsub();
    secondObserver.destroy();
    queryClient.clear();
  });

  it('keeps an initial auth error visible without duplicate fetching and retries only when Retry is clicked', async () => {
    const queryClient = new QueryClient();
    liveblocksAuthMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(liveAuth('recovered-token'));

    const observer = new QueryObserver(
      queryClient,
      canvasLiveblocksAuthQuery('c1', 'opening-error')
    );
    const unsubscribe = observer.subscribe(() => {});
    const failed = await waitForObserver(observer, (r) => r.isError);

    expect(liveblocksAuthMock).toHaveBeenCalledTimes(1);

    // Rendering CanvasCollabProvider with the opening-scoped error state must not start a duplicate fetch.
    const authState: CanvasLiveblocksAuthState = failed;
    const html = renderToStaticMarkup(
      <CanvasCollabProvider
        canvasId="c1"
        auth={authState}
        fallback={<div>loading</div>}
      >
        <div>editor</div>
      </CanvasCollabProvider>
    );
    expect(html).toContain('Couldn&#x27;t open live editing');
    expect(html).toContain('Retry');
    expect(liveblocksAuthMock).toHaveBeenCalledTimes(1);

    // Clicking Retry triggers a single refetch that recovers the opening.
    const tree = CanvasCollabProvider({
      canvasId: 'c1',
      auth: authState,
      fallback: <div>loading</div>,
      children: <div>editor</div>,
    });
    const retryButton = findElement(
      tree,
      (el) =>
        el.props.children === 'Retry' && typeof el.props.onClick === 'function'
    );
    expect(retryButton).not.toBeNull();

    retryButton?.props.onClick?.();
    const recovered = await waitForObserver(
      observer,
      (r) => !r.isError && r.data !== undefined
    );

    expect(liveblocksAuthMock).toHaveBeenCalledTimes(2);
    expect(recovered.data).toEqual(liveAuth('recovered-token'));

    unsubscribe();
    observer.destroy();
    queryClient.clear();
  });

  it('evicts the cached token on deactivation cleanup so an immediate state-preserving reopen cannot reuse it', async () => {
    const queryClient = new QueryClient();
    liveblocksAuthMock
      .mockResolvedValueOnce(liveAuth('revoked-token'))
      .mockResolvedValueOnce(liveAuth('fresh-token'));

    const options = canvasLiveblocksAuthQuery('c1', 'preserved-opening');
    const firstObserver = new QueryObserver(queryClient, options);
    const firstUnsub = firstObserver.subscribe(() => {});
    const firstResult = await waitForObserver(
      firstObserver,
      (r) => !r.isPending
    );
    expect(firstResult.data).toEqual(liveAuth('revoked-token'));
    expect(liveblocksAuthMock).toHaveBeenCalledTimes(1);

    // Simulate Next.js Cache Components (<Activity>) hiding the route: effect cleanup purges the query synchronously.
    firstUnsub();
    firstObserver.destroy();
    queryClient.removeQueries({ queryKey: options.queryKey, exact: true });

    // Even if a re-activated tree re-subscribes immediately with the same key before state rotates, it fetches fresh.
    const secondObserver = new QueryObserver(queryClient, options);
    const secondUnsub = secondObserver.subscribe(() => {});
    expect(secondObserver.getCurrentResult().data).toBeUndefined();
    const secondResult = await waitForObserver(
      secondObserver,
      (r) => !r.isPending
    );

    expect(liveblocksAuthMock).toHaveBeenCalledTimes(2);
    expect(secondResult.data).toEqual(liveAuth('fresh-token'));

    secondUnsub();
    secondObserver.destroy();
    queryClient.clear();
  });
});
