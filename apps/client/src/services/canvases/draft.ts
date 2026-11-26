'use client';

import type { CanvasDraft } from '@conduit/contract';
import { ORPCError } from '@orpc/client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { client } from '@/lib/orpc';

export type CanvasDraftState =
  | { status: 'idle' }
  | { status: 'streaming'; title: string; markdown: string }
  | { status: 'done'; draft: CanvasDraft }
  | { status: 'error'; code: string | null; message: string };

/** Streams one canvas draft of a thread at a time. Stopping it, or unmounting, aborts the request. */
export function useCanvasDraftRun() {
  const [state, setState] = useState<CanvasDraftState>({ status: 'idle' });
  const running = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    running.current?.abort();
    running.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const draft = useCallback(
    async (messageId: string) => {
      stop();
      const controller = new AbortController();
      running.current = controller;
      setState({ status: 'streaming', title: '', markdown: '' });

      try {
        const events = await client.canvases.draftFromThread(
          { messageId },
          { signal: controller.signal }
        );
        for await (const event of events) {
          if (controller.signal.aborted) return;
          setState(
            event.type === 'partial'
              ? {
                  status: 'streaming',
                  title: event.title,
                  markdown: event.markdown,
                }
              : { status: 'done', draft: event.draft }
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          code: error instanceof ORPCError ? error.code : null,
          message:
            error instanceof Error ? error.message : 'Something went wrong.',
        });
      } finally {
        if (running.current === controller) running.current = null;
      }
    },
    [stop]
  );

  const dismiss = useCallback(() => {
    stop();
    setState({ status: 'idle' });
  }, [stop]);

  return { state, draft, dismiss };
}
