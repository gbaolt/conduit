import { useSyncExternalStore } from 'react';

import {
  DEFAULT_QUICK_REACTIONS,
  parseQuickReactions,
  type QuickReactions,
  replaceQuickReaction,
} from '../lib/quick-reactions';

const storageKey = 'conduit:quick-reactions';
const listeners = new Set<() => void>();
// Holds the choice for this visit when localStorage is blocked.
let memory: string | null = null;
let cached: { raw: string | null; value: QuickReactions } = {
  raw: null,
  value: DEFAULT_QUICK_REACTIONS,
};

function readRaw() {
  try {
    return localStorage.getItem(storageKey) ?? memory;
  } catch {
    return memory;
  }
}

// Every message row reads this, so the parsed array stays the same object until storage changes.
function snapshot() {
  const raw = readRaw();
  if (raw !== cached.raw) cached = { raw, value: parseQuickReactions(raw) };
  return cached.value;
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) listener();
  };
  listeners.add(listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The viewer's three quick reactions, kept in localStorage and shared by every row and tab. */
export function useQuickReactions() {
  const reactions = useSyncExternalStore(
    subscribe,
    snapshot,
    () => DEFAULT_QUICK_REACTIONS
  );

  const replace = (slot: number, emoji: string) => {
    memory = JSON.stringify(replaceQuickReaction(snapshot(), slot, emoji));
    try {
      localStorage.setItem(storageKey, memory);
    } catch {
      // Blocked storage: the choice lasts for this visit.
    }
    for (const listener of listeners) listener();
  };

  return { reactions, replace };
}
