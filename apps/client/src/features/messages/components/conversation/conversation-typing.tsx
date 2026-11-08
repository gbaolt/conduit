'use client';

import { useState } from 'react';

import { useTypers } from '@/services/activity/hooks';
import { useWorkspaceMembers } from '@/services/workspaces/hooks';

function typingText(names: readonly string[]) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return 'Several people are typing';
}

/**
 * Who is typing, in 12 px muted words under the composer. It keeps its height when empty, so the composer
 * never jumps, and fades its text instead of swapping it.
 */
export function ConversationTyping({
  roomId,
  parentId,
}: {
  roomId: string;
  parentId?: string;
}) {
  const typers = useTypers(roomId, parentId);
  const { data: members } = useWorkspaceMembers();
  const names = typers.map(
    (userId) =>
      members?.find((member) => member.userId === userId)?.name ?? 'Someone'
  );
  const text = typingText(names);

  // Keeps the last words on screen while they fade out.
  const [shown, setShown] = useState(text);
  if (text && text !== shown) setShown(text);

  return (
    <p
      role="status"
      className="text-muted-foreground h-5 text-xs leading-5 transition-opacity duration-120 motion-reduce:transition-none"
      style={{ opacity: text ? 1 : 0 }}
    >
      {shown}
    </p>
  );
}
