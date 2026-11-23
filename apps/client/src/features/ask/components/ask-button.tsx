'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { IconSparkles } from '@tabler/icons-react';

import { useAsk } from '../context/ask-provider';

/** Opens and closes Ask Conduit from beside the search bar, on the last chat. Gone while the workspace has AI turned off. */
export function AskButton() {
  const { available, open, openAsk, close } = useAsk();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Ask Conduit"
            aria-expanded={open}
            onClick={() => (open ? close() : openAsk())}
            disabled={!available}
            className="group/ask text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground aria-expanded:border-primary/50 aria-expanded:bg-primary/10 aria-expanded:text-foreground dark:hover:border-primary/40 dark:hover:bg-primary/10 dark:aria-expanded:bg-primary/15 shadow-none transition-[color,background-color,border-color,scale] duration-150"
          />
        }
      >
        <IconSparkles className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/ask:scale-110 group-hover/ask:rotate-12 motion-reduce:transition-none" />
      </TooltipTrigger>
      <TooltipContent>Ask Conduit</TooltipContent>
    </Tooltip>
  );
}
