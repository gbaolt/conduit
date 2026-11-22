'use client';

import { Sheet, SheetContent } from '@conduit/ui/components/sheet';

import { SidePanel } from '@/components/side-panel';
import { useMediaQuery } from '@/hooks/use-media-query';

import { useAsk } from '../context/ask-provider';
import { AskPanelHeader } from './ask-panel-header';
import { AskPromptForm } from './ask-prompt-form';
import { AskTranscript } from './ask-transcript';

function AskChat({ onOpenSource }: { onOpenSource: () => void }) {
  const { close, announcement } = useAsk();

  return (
    <section
      aria-label="Ask Conduit"
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) close();
      }}
    >
      <AskPanelHeader />
      <AskTranscript onOpenSource={onOpenSource} />
      <AskPromptForm />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

const keepOpen = () => {};

/**
 * Ask Conduit's chat. From xl it sits in the side card, so a cited message opens beside it. Narrower, it covers
 * the screen in a sheet, and opening a source closes it.
 */
export function AskPanel() {
  const { open, close } = useAsk();
  const docked = useMediaQuery('(min-width: 80rem)');

  if (docked) {
    return (
      open && (
        <SidePanel>
          <AskChat onOpenSource={keepOpen} />
        </SidePanel>
      )
    );
  }
  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-label="Ask Conduit"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <AskChat onOpenSource={close} />
      </SheetContent>
    </Sheet>
  );
}
