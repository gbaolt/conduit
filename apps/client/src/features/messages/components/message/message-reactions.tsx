'use client';

import type { Message } from '@conduit/contract';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { cn } from '@conduit/ui/lib/utils';
import { IconMoodPlus } from '@tabler/icons-react';
import { use } from 'react';

import { useToggleReaction } from '@/services/messages/hooks';

import { MentionNames } from '../../context/mention-names';
import { reactorLabel } from '../../lib/reactors';
import { EmojiPickerButton } from '../emoji-picker';

/** The reaction pills under a message, and the `+` that adds another emoji. Nothing renders without a reaction. */
export function MessageReactions({
  message,
  viewerId,
  canReact,
}: {
  message: Pick<Message, 'id' | 'roomId' | 'reactions'>;
  viewerId: string | null;
  canReact: boolean;
}) {
  const names = use(MentionNames);
  const toggle = useToggleReaction(message.roomId);
  const entries = Object.entries(message.reactions);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 pt-1">
      {entries.map(([emoji, userIds]) => {
        const reacted = viewerId !== null && userIds.includes(viewerId);
        return (
          <Tooltip key={emoji}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!canReact}
                  aria-pressed={reacted}
                  aria-label={`${emoji} ${userIds.length}`}
                  className={cn(
                    'focus-visible:ring-ring/50 inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums outline-none focus-visible:ring-3 pointer-coarse:h-11',
                    reacted
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-muted'
                  )}
                  onClick={() => toggle(message, emoji)}
                />
              }
            >
              <span aria-hidden>{emoji}</span>
              {userIds.length}
            </TooltipTrigger>
            <TooltipContent>
              {reactorLabel(userIds, names, viewerId)}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {canReact && (
        <EmojiPickerButton
          label="Add reaction"
          variant="outline"
          className="h-6 rounded-full px-2 pointer-coarse:h-11"
          onPick={(emoji) => toggle(message, emoji)}
        >
          <IconMoodPlus className="size-4" />
        </EmojiPickerButton>
      )}
    </div>
  );
}
