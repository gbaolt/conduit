'use client';

import { MESSAGE_BODY_MAX } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Popover, PopoverContent } from '@conduit/ui/components/popover';
import { Textarea } from '@conduit/ui/components/textarea';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useCreateCanvasCommentThread } from '@/services/canvases/hooks';

import {
  type CanvasCommentDraft,
  useCanvasComments,
} from './canvas-comments-plugin';

function CanvasCommentPopoverForm({ draft }: { draft: CanvasCommentDraft }) {
  const [editor] = useLexicalComposerContext();
  const { canvasId, cancelDraft, markDraft, notify, openThread } =
    useCanvasComments();
  const create = useCreateCanvasCommentThread();
  const [body, setBody] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);

  const close = () => {
    cancelDraft();
    editor.focus();
  };

  const submit = () => {
    if (!body.trim() || create.isPending) return;
    create.mutate(
      { canvasId, quote: draft.quote, body },
      {
        onSuccess: (thread) => {
          markDraft(thread.id);
          notify();
          cancelDraft();
          openThread(thread.id);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Popover open onOpenChange={(open) => !open && close()}>
      <PopoverContent
        anchor={{ getBoundingClientRect: () => draft.rect }}
        side="bottom"
        align="start"
        sideOffset={8}
        initialFocus={field}
        aria-label="Comment on the selected text"
        // A shortcut answers at once; a click grows from the selection it is about.
        className={
          draft.trigger === 'keyboard'
            ? 'w-80 data-open:animate-none'
            : 'w-80 duration-150 ease-out'
        }
      >
        <Textarea
          ref={field}
          aria-label="Comment"
          placeholder="Add a comment"
          value={body}
          maxLength={MESSAGE_BODY_MAX}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          className="min-h-20 resize-none"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
          <StatusButton
            size="sm"
            disabled={!body.trim()}
            status={create.isPending ? 'loading' : 'idle'}
            onClick={submit}
          >
            Comment
          </StatusButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The comment box anchored under the selection it is about, while a comment is being written. */
export function CanvasCommentPopover() {
  const { draft } = useCanvasComments();
  return draft && <CanvasCommentPopoverForm draft={draft} />;
}
