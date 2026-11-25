'use client';

import { CANVAS_UNTITLED, type CanvasDocument } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  usePendingCanvasUpdates,
  useUpdateCanvas,
} from '@/services/canvases/hooks';

import {
  $isEmptyCanvas,
  $seedCanvasFromMarkdown,
} from '../lib/canvas-extension';
import { CANVAS_TEMPLATES, type CanvasTemplate } from '../lib/canvas-templates';

/**
 * The templates under an empty canvas's placeholder, as Slack offers when a canvas is created. Picking one
 * fills the document as one ordinary edit, so a live canvas sends it to everyone and undo takes it back.
 */
export function CanvasTemplatePicker({ canvas }: { canvas: CanvasDocument }) {
  const [editor] = useLexicalComposerContext();
  const [empty, setEmpty] = useState(() => editor.read($isEmptyCanvas));
  const update = useUpdateCanvas();
  const pendingUpdates = usePendingCanvasUpdates();

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) =>
        setEmpty(editorState.read($isEmptyCanvas))
      ),
    [editor]
  );

  if (!empty) return null;

  const apply = (template: CanvasTemplate) => {
    let applied = false;
    editor.update(
      () => {
        // Someone else may have typed since the picker rendered, and seeding clears the document.
        if (!$isEmptyCanvas()) return;
        $seedCanvasFromMarkdown(template.markdown, new Map());
        applied = true;
      },
      { onUpdate: () => editor.focus() }
    );
    if (!applied) return;
    // A rename still saving, such as the title's blur on this very click, is not in `canvas` yet.
    const saving = pendingUpdates();
    const patch = {
      ...(canvas.title === CANVAS_UNTITLED &&
        !saving.some((input) => input.title !== undefined) && {
          title: template.label,
        }),
      ...(!canvas.icon &&
        !saving.some((input) => input.icon !== undefined) && {
          icon: template.icon,
        }),
    };
    if (Object.keys(patch).length === 0) return;
    update.mutate(
      { canvasId: canvas.id, ...patch },
      { onError: (error) => toast.error(error.message) }
    );
  };

  return (
    <div
      role="group"
      aria-label="Templates"
      className="pointer-events-none absolute top-16 right-0 left-8 flex flex-col gap-2"
    >
      <p className="text-muted-foreground text-sm">Or start from a template</p>
      <div className="pointer-events-auto flex w-fit flex-wrap gap-2">
        {CANVAS_TEMPLATES.map((template) => (
          <Button
            key={template.id}
            variant="outline"
            size="sm"
            onClick={() => apply(template)}
          >
            <span data-icon="inline-start" aria-hidden className="flex">
              <Twemoji className="size-4">{template.icon}</Twemoji>
            </span>
            {template.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
