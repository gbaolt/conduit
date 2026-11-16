'use client';

import {
  EmojiPicker,
  EmojiPickerCategories,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerHeader,
  EmojiPickerList,
  EmojiPickerPreview,
  EmojiPickerSearch,
  EmojiPickerSkinTone,
  EmojiPickerTrigger,
} from '@conduit/ui/components/emoji-picker';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { cn } from '@conduit/ui/lib/utils';
import { useRef, useState } from 'react';

import { useQuickReactions } from '../../hooks/use-quick-reactions';
import type { EmojiPickerButtonProps } from '../emoji-picker';

/**
 * The reaction picker. Its last row shows the quick reactions: choosing a slot
 * makes the next pick replace that slot instead of reacting.
 */
export function ReactionPickerButton({
  label,
  onPick,
  onOpenChange,
  children,
  ...button
}: EmojiPickerButtonProps) {
  const { reactions, replace } = useQuickReactions();
  const [editing, setEditing] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <EmojiPicker
      aria-label={label}
      closeOnSelect={editing === null}
      onOpenChange={(open) => {
        if (!open) setEditing(null);
        onOpenChange?.(open);
      }}
      onEmojiSelect={({ value }) => {
        if (editing === null) return onPick(value);
        replace(editing, value);
        setEditing(null);
      }}
    >
      <Tooltip>
        <TooltipTrigger render={<EmojiPickerTrigger {...button} />}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <EmojiPickerContent>
        <EmojiPickerHeader>
          <EmojiPickerSearch ref={searchRef} />
        </EmojiPickerHeader>
        <EmojiPickerCategories />
        <EmojiPickerList />
        <EmojiPickerFooter>
          <EmojiPickerPreview />
          <EmojiPickerSkinTone />
        </EmojiPickerFooter>
        <div
          role="group"
          aria-label="Quick reactions"
          className="bg-muted/40 flex h-10 shrink-0 items-center gap-1 border-t px-2"
        >
          <p
            aria-live="polite"
            className="text-muted-foreground min-w-0 flex-1 truncate text-xs"
          >
            {editing === null
              ? 'Quick reactions'
              : `Pick an emoji for slot ${editing + 1}`}
          </p>
          {reactions.map((emoji, slot) => (
            <Tooltip key={slot}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Change quick reaction ${slot + 1}, ${emoji}`}
                    aria-pressed={editing === slot}
                    className={cn(
                      'focus-visible:ring-ring/50 flex size-7 items-center justify-center rounded-md border border-dashed transition-[transform,background-color,border-color] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.97] motion-reduce:transition-none pointer-coarse:size-11',
                      editing === slot
                        ? 'border-primary bg-primary/10 border-solid'
                        : 'hover:bg-accent hover:border-border border-transparent'
                    )}
                    onClick={() => {
                      setEditing(editing === slot ? null : slot);
                      // Typing right away searches for the replacement.
                      searchRef.current?.focus();
                    }}
                  />
                }
              >
                <Twemoji
                  key={emoji}
                  className="animate-in fade-in-0 zoom-in-90 motion-reduce:zoom-in-100 m-0 size-4 align-middle duration-150 ease-out"
                >
                  {emoji}
                </Twemoji>
              </TooltipTrigger>
              <TooltipContent>
                {editing === slot ? 'Cancel' : 'Change'}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </EmojiPickerContent>
    </EmojiPicker>
  );
}
