import { useState } from 'react';

/** True from the first time `open` is, so a lazy panel loads on first open and still plays its close animation. */
export function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}
