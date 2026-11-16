'use client';

import { createContext, use } from 'react';

/** Opens a thread beside the conversation. Null where no panel exists, so rows offer no reply button. */
export const OpenThread = createContext<((rootId: string) => void) | null>(
  null
);

export const useOpenThread = () => use(OpenThread);
