import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};

/** False while rendering on the server and during hydration. Anything that depends on the viewer's time zone waits for it. */
export function useIsClient() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
}
