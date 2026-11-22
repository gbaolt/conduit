'use client';

import { Button } from '@conduit/ui/components/button';
import { IconSparkles } from '@tabler/icons-react';

import { useAsk } from '../context/ask-provider';

/** Opens and closes Ask Conduit from the top bar, on the last chat. Gone while the workspace has AI turned off. */
export function AskButton() {
  const { available, open, openAsk, close } = useAsk();
  if (!available) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={open}
      onClick={() => (open ? close() : openAsk())}
    >
      <IconSparkles data-icon="inline-start" />
      Ask Conduit
    </Button>
  );
}
