'use client';

import { Button } from '@conduit/ui/components/button';
import { Input } from '@conduit/ui/components/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@conduit/ui/components/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { type ComponentProps, useEffect, useState } from 'react';

type Emoji = {
  emoji: string;
  description: string;
  aliases: string[];
  tags: string[];
};

const QUICK = ['👍', '❤️', '😂', '🎉', '😮', '🙏', '👀', '🚀'];
const RESULT_LIMIT = 64;

/** The kit's emoji list is large, so it loads when the picker first opens. */
function useEmojiList(enabled: boolean) {
  const [emojis, setEmojis] = useState<readonly Emoji[]>([]);

  useEffect(() => {
    if (!enabled || emojis.length > 0) return;
    let cancelled = false;
    void import('@/components/editor/utils/emoji-list').then((file) => {
      if (!cancelled) setEmojis(file.default);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, emojis.length]);

  return emojis;
}

export function searchEmojis(emojis: readonly Emoji[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return emojis.slice(0, RESULT_LIMIT);

  return emojis
    .filter(
      (entry) =>
        entry.description.toLowerCase().includes(needle) ||
        entry.aliases.some((alias) => alias.includes(needle)) ||
        entry.tags.some((tag) => tag.includes(needle))
    )
    .slice(0, RESULT_LIMIT);
}

function Picker({ onPick }: { onPick: (emoji: string) => void }) {
  const emojis = useEmojiList(true);
  const [query, setQuery] = useState('');
  const results = searchEmojis(emojis, query);

  return (
    <div className="flex flex-col gap-2">
      <Input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search emoji"
        aria-label="Search emoji"
      />
      {!query && (
        <div className="flex flex-wrap gap-0.5">
          {QUICK.map((emoji) => (
            <EmojiButton key={emoji} emoji={emoji} onPick={onPick} />
          ))}
        </div>
      )}
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
        {results.map((entry) => (
          <EmojiButton
            key={entry.emoji}
            emoji={entry.emoji}
            label={entry.description}
            onPick={onPick}
          />
        ))}
      </div>
      {query && emojis.length > 0 && results.length === 0 && (
        <p className="text-muted-foreground text-xs">No emoji found.</p>
      )}
    </div>
  );
}

function EmojiButton({
  emoji,
  label,
  onPick,
}: {
  emoji: string;
  label?: string;
  onPick: (emoji: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label ?? emoji}
      className="size-7 text-base pointer-coarse:size-11"
      onClick={() => onPick(emoji)}
    >
      {emoji}
    </Button>
  );
}

/** A button with a tooltip that opens the emoji picker. The popover closes after a pick. */
export function EmojiPickerButton({
  label,
  onPick,
  onOpenChange,
  children,
  ...button
}: Omit<ComponentProps<typeof Button>, 'onClick'> & {
  label: string;
  onPick: (emoji: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={<Button type="button" aria-label={label} {...button} />}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80">
        <Picker
          onPick={(emoji) => {
            setOpen(false);
            onPick(emoji);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
