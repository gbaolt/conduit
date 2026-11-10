'use client';

import type { Button } from '@conduit/ui/components/button';
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerTrigger,
} from '@conduit/ui/components/emoji-picker';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import type { ComponentProps } from 'react';

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
  return (
    <EmojiPicker
      aria-label={label}
      onOpenChange={onOpenChange}
      onEmojiSelect={({ value }) => onPick(value)}
    >
      <Tooltip>
        <TooltipTrigger render={<EmojiPickerTrigger {...button} />}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <EmojiPickerContent />
    </EmojiPicker>
  );
}
