'use client';

import { Sheet, SheetContent } from '@conduit/ui/components/sheet';

import { SidePanel } from '@/components/side-panel';
import { useMediaQuery } from '@/hooks/use-media-query';

import { useAsk } from '../context/ask-provider';
import { AskGuidePanel } from './ask-guide-panel';
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
 * Ask Conduit's chat. From xl it sits in the side card, so a cited message opens beside it, and a cited guide
 * article stacks over it. Narrower, it covers the screen in a sheet, opening a source closes it, and a guide
 * article shows in its place while the chat stays mounted behind it.
 */
export function AskPanel() {
  const { open, close, guide } = useAsk();
  const docked = useMediaQuery('(min-width: 80rem)');

  if (docked) {
    return (
      open && (
        <>
          <SidePanel>
            <AskChat onOpenSource={keepOpen} />
          </SidePanel>
          {guide && (
            <SidePanel>
              <AskGuidePanel key={guide} slug={guide} />
            </SidePanel>
          )}
        </>
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
        <div className={guide ? 'hidden' : 'contents'}>
          <AskChat onOpenSource={close} />
        </div>
        {guide && <AskGuidePanel key={guide} slug={guide} />}
      </SheetContent>
    </Sheet>
  );
}
