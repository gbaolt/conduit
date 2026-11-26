'use client';

import { Button } from '@conduit/ui/components/button';
import { Separator } from '@conduit/ui/components/separator';
import { IconMessagePlus } from '@tabler/icons-react';

import { useCanvasComments } from './canvas-comments-plugin';

/** The floating toolbar's Comment button, for the selected text. */
export function CanvasCommentPopoverButton() {
  const { startDraft } = useCanvasComments();
  return (
    <>
      <Separator orientation="vertical" />
      <Button
        variant="ghost"
        size="sm"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => startDraft('toolbar')}
      >
        <IconMessagePlus data-icon="inline-start" />
        Comment
      </Button>
    </>
  );
}
