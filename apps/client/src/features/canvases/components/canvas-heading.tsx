'use client';

import {
  CANVAS_COVER_PRESETS,
  CANVAS_TITLE_MAX,
  type CanvasCoverPreset,
  type CanvasDocument,
  type UpdateCanvasInput,
} from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@conduit/ui/components/popover';
import { Textarea } from '@conduit/ui/components/textarea';
import { Twemoji } from '@conduit/ui/components/twemoji';
import { cn } from '@conduit/ui/lib/utils';
import { IconMoodSmile, IconPhoto, IconX } from '@tabler/icons-react';
import { type ReactElement, useRef, useState } from 'react';
import { toast } from 'sonner';

import { EmojiPickerButton } from '@/features/messages/components/emoji-picker';
import { useUpdateCanvas } from '@/services/canvases/hooks';

import { CANVAS_COVERS } from '../lib/canvas-covers';

type CanvasPatch = Omit<UpdateCanvasInput, 'canvasId'>;

function useCanvasPatch(canvasId: string) {
  const update = useUpdateCanvas();
  return (patch: CanvasPatch, onError?: () => void) =>
    update.mutate(
      { canvasId, ...patch },
      {
        onError: (error) => {
          onError?.();
          toast.error(error.message);
        },
      }
    );
}

/** The eight presets, and a way back to no cover. */
function CanvasCoverPicker({
  canvas,
  trigger,
}: {
  canvas: CanvasDocument;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const patch = useCanvasPatch(canvas.id);
  const choose = (coverPreset: CanvasCoverPreset | null) => {
    setOpen(false);
    patch({ coverPreset });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-72">
        <div
          role="group"
          aria-label="Covers"
          className="grid grid-cols-4 gap-2"
        >
          {CANVAS_COVER_PRESETS.map((preset) => (
            <Button
              key={preset}
              variant="ghost"
              aria-label={CANVAS_COVERS[preset].label}
              aria-pressed={canvas.coverPreset === preset}
              onClick={() => choose(preset)}
              className={cn(
                'aria-pressed:ring-ring h-10 w-full aria-pressed:ring-2',
                CANVAS_COVERS[preset].className
              )}
            />
          ))}
        </div>
        {canvas.coverPreset && (
          <Button variant="ghost" size="sm" onClick={() => choose(null)}>
            <IconX data-icon="inline-start" />
            Remove cover
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** The band across the top of a canvas, when it has a cover. Editors change it from its corner. */
export function CanvasCover({ canvas }: { canvas: CanvasDocument }) {
  if (!canvas.coverPreset) return null;

  return (
    <div
      data-slot="canvas-cover"
      className={cn(
        'group/cover relative col-span-full h-36 sm:h-44',
        CANVAS_COVERS[canvas.coverPreset].className
      )}
    >
      {canvas.access.edit && (
        <CanvasCoverPicker
          canvas={canvas}
          trigger={
            <Button
              variant="secondary"
              size="sm"
              className="absolute right-4 bottom-3 opacity-0 transition-opacity group-hover/cover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <IconPhoto data-icon="inline-start" />
              Change cover
            </Button>
          }
        />
      )}
    </div>
  );
}

/** The title, renamed in place. It saves on Enter or when focus leaves, and Escape puts the old one back. */
function CanvasTitle({
  canvas,
  onEnter,
}: {
  canvas: CanvasDocument;
  onEnter?: () => void;
}) {
  const patch = useCanvasPatch(canvas.id);
  const [title, setTitle] = useState(canvas.title);
  // Escape blurs before React applies the reset, so the blur's commit would still see the edited title.
  const cancelled = useRef(false);

  if (!canvas.access.edit) {
    return (
      <h1 className="text-3xl font-bold tracking-tight break-words">
        {canvas.title}
      </h1>
    );
  }

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = title.trim();
    if (!next || next === canvas.title) {
      setTitle(canvas.title);
      return;
    }
    patch({ title: next }, () => setTitle(canvas.title));
  };

  return (
    <Textarea
      aria-label="Canvas title"
      placeholder="Untitled"
      rows={1}
      value={title}
      maxLength={CANVAS_TITLE_MAX}
      onChange={(event) => setTitle(event.target.value.replace(/\n/g, ' '))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
          onEnter?.();
        }
        if (event.key === 'Escape') {
          cancelled.current = true;
          setTitle(canvas.title);
          event.currentTarget.blur();
        }
      }}
      className="placeholder:text-muted-foreground/60 min-h-0 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-3xl font-bold tracking-tight shadow-none focus-visible:ring-0 md:text-3xl dark:bg-transparent"
    />
  );
}

/**
 * The top of the document: the icon, the title, and for editors the buttons that add an icon or a cover. Like
 * Slack and Notion, those buttons show while the pointer is over the heading, and always on touch screens.
 */
export function CanvasHeading({
  canvas,
  onEnter,
}: {
  canvas: CanvasDocument;
  /** Enter in the title: save it and start writing on a new first line of the document. */
  onEnter?: () => void;
}) {
  const patch = useCanvasPatch(canvas.id);
  const edit = canvas.access.edit;
  const pickIcon = (icon: string) => patch({ icon });

  return (
    <div data-slot="canvas-heading" className="group/heading mb-6 pl-8">
      {canvas.icon &&
        (edit ? (
          <EmojiPickerButton
            label="Change icon"
            variant="ghost"
            onPick={pickIcon}
            className="-ml-2 size-16 text-5xl"
          >
            <Twemoji className="size-12">{canvas.icon}</Twemoji>
          </EmojiPickerButton>
        ) : (
          <div className="text-5xl">
            <Twemoji className="size-12">{canvas.icon}</Twemoji>
          </div>
        ))}
      {edit && (
        <div className="-ml-2.5 flex min-h-8 items-center gap-1 opacity-0 transition-opacity group-focus-within/heading:opacity-100 group-hover/heading:opacity-100 has-data-popup-open:opacity-100 [@media(hover:none)]:opacity-100">
          {canvas.icon ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => patch({ icon: null })}
            >
              <IconX data-icon="inline-start" />
              Remove icon
            </Button>
          ) : (
            <EmojiPickerButton
              label="Add icon"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onPick={pickIcon}
            >
              <IconMoodSmile data-icon="inline-start" />
              Add icon
            </EmojiPickerButton>
          )}
          {!canvas.coverPreset && (
            <CanvasCoverPicker
              canvas={canvas}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <IconPhoto data-icon="inline-start" />
                  Add cover
                </Button>
              }
            />
          )}
        </div>
      )}
      <CanvasTitle key={canvas.title} canvas={canvas} onEnter={onEnter} />
    </div>
  );
}
