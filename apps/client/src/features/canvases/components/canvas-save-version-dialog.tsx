'use client';

import { CANVAS_VERSION_LABEL_MAX } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { Field, FieldLabel } from '@conduit/ui/components/field';
import { Input } from '@conduit/ui/components/input';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { type FormEvent, useId, useState } from 'react';
import { toast } from 'sonner';

import { StatusButton } from '@/components/async/status-button';
import { useCreateCanvasVersion } from '@/services/canvases/hooks';

import { canvasMarkdownOf } from '../lib/canvas-extension';

/** Centered, so it grows from the middle; reduced motion keeps only the fade. */
export const CANVAS_DIALOG_MOTION =
  'duration-200 ease-out motion-reduce:data-open:zoom-in-100 motion-reduce:data-closed:zoom-out-100';

/** Names and keeps the canvas's content as it is now. Renders inside the live editor. */
export function CanvasSaveVersionDialog({
  canvasId,
  open,
  onOpenChange,
  onSaved,
}: {
  canvasId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const create = useCreateCanvasVersion();
  const [label, setLabel] = useState('');
  const inputId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const snapshotJson = editor.getEditorState().toJSON() as unknown as Record<
      string,
      unknown
    >;
    create.mutate(
      {
        canvasId,
        label: label.trim() || undefined,
        snapshotJson,
        markdown: canvasMarkdownOf(editor),
      },
      {
        onSuccess: () => {
          toast.success('Version saved.');
          setLabel('');
          onOpenChange(false);
          onSaved();
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={CANVAS_DIALOG_MOTION}>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Save version</DialogTitle>
            <DialogDescription>
              Keep the canvas as it is now, so anyone can preview or restore it
              from History.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={inputId}>Name</FieldLabel>
            <Input
              id={inputId}
              value={label}
              placeholder="v1 spec"
              maxLength={CANVAS_VERSION_LABEL_MAX}
              autoFocus
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <StatusButton
              type="submit"
              status={create.isPending ? 'loading' : 'idle'}
            >
              Save version
            </StatusButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
