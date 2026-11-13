import type { SidebarEntry } from '@conduit/contract';
import { describe, expect, it } from 'vitest';

import { isUnread } from '../queries';

const at = (minute: number) => new Date(2026, 10, 7, 10, minute);

function entry(overrides: Partial<SidebarEntry> = {}): SidebarEntry {
  return {
    roomId: 'c1',
    lastMessageAt: at(30),
    joinedAt: at(0),
    lastReadAt: null,
    hasDraft: false,
    mutedAt: null,
    ...overrides,
  };
}

describe('isUnread', () => {
  it('is unread when a message came after the last read', () => {
    expect(isUnread(entry({ lastReadAt: at(10) }))).toBe(true);
  });

  it('is read once the viewer has read the newest message', () => {
    expect(isUnread(entry({ lastReadAt: at(30) }))).toBe(false);
  });

  it('counts a conversation never read as read up to the join time', () => {
    expect(isUnread(entry({ lastMessageAt: at(-5) }))).toBe(false);
    expect(isUnread(entry({ lastMessageAt: at(5) }))).toBe(true);
  });

  it('is read when nothing was ever sent, or the conversation is unknown', () => {
    expect(isUnread(entry({ lastMessageAt: null }))).toBe(false);
    expect(isUnread(undefined)).toBe(false);
  });
});
