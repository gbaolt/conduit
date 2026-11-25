'use client';

import { Button } from '@conduit/ui/components/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@conduit/ui/components/hover-card';
import { cn } from '@conduit/ui/lib/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode } from '@lexical/rich-text';
import { $getRoot, type LexicalEditor, type NodeKey } from 'lexical';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type CanvasHeading = {
  key: NodeKey;
  text: string;
  /** 1 for `h1`. Deeper headings than `h3` indent as `h3`. */
  depth: number;
};

/** A heading counts as passed once its top scrolls within this distance of the top of the canvas. */
const ACTIVE_OFFSET_PX = 96;

function $readHeadings(): CanvasHeading[] {
  return $getRoot()
    .getChildren()
    .filter($isHeadingNode)
    .map((node) => ({
      key: node.getKey(),
      text: node.getTextContent(),
      depth: Math.min(Number(node.getTag().slice(1)), 3),
    }));
}

function useCanvasHeadings(editor: LexicalEditor) {
  const [headings, setHeadings] = useState(() =>
    editor.getEditorState().read($readHeadings)
  );

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const next = editorState.read($readHeadings);
        // Most edits leave the outline as it was, so they must not re-render it.
        setHeadings((current) =>
          JSON.stringify(current) === JSON.stringify(next) ? current : next
        );
      }),
    [editor]
  );

  return headings;
}

/** The last heading scrolled past the top of the canvas, or the last one once the canvas is scrolled to its end. */
function useActiveHeading(editor: LexicalEditor, headings: CanvasHeading[]) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [activeKey, setActiveKey] = useState<NodeKey | null>(null);

  useEffect(() => editor.registerRootListener(setRoot), [editor]);

  useEffect(() => {
    const scroller = root?.closest('[data-slot="canvas-layout"]');
    if (!scroller || headings.length === 0) return;
    const update = () => {
      const atEnd =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      if (atEnd && scroller.scrollTop > 0) {
        setActiveKey(headings.at(-1)!.key);
        return;
      }
      const line = scroller.getBoundingClientRect().top + ACTIVE_OFFSET_PX;
      let active = headings[0]!.key;
      for (const heading of headings) {
        const element = editor.getElementByKey(heading.key);
        if (element && element.getBoundingClientRect().top <= line) {
          active = heading.key;
        }
      }
      setActiveKey(active);
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, [editor, root, headings]);

  return activeKey;
}

/**
 * The column the outline sits in. It mirrors across the document: the dashes hug the document's edge, deeper
 * headings indent away from it, and the list opens over the document.
 */
const SIDES = {
  left: {
    root: 'mr-auto',
    track: 'items-end pr-4',
    dash: 'data-[depth=2]:mr-2 data-[depth=3]:mr-4',
    popup: 'right',
  },
  right: {
    root: 'ml-auto',
    track: 'items-start pl-4',
    dash: 'data-[depth=2]:ml-2 data-[depth=3]:ml-4',
    popup: 'left',
  },
} as const;

function scrollToHeading(editor: LexicalEditor, key: NodeKey) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  editor
    .getElementByKey(key)
    ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
}

/**
 * The canvas outline, drawn into `slot`: a dash per heading with the one in view highlighted. Hovering it opens the
 * headings as a list, and picking one scrolls the canvas to it. Renders nothing while the canvas has no headings.
 */
export function CanvasToc({
  slot,
  side,
}: {
  slot: HTMLElement | null;
  side: keyof typeof SIDES;
}) {
  const [editor] = useLexicalComposerContext();
  const headings = useCanvasHeadings(editor);
  const activeKey = useActiveHeading(editor, headings);

  if (!slot || headings.length === 0) return null;
  const layout = SIDES[side];

  return createPortal(
    <div className={cn('w-18', layout.root)}>
      <HoverCard>
        <HoverCardTrigger
          delay={100}
          closeDelay={100}
          render={
            <div
              className={cn(
                'flex max-h-[50dvh] flex-col gap-3 overflow-hidden py-3 opacity-100 transition-opacity duration-200 data-popup-open:opacity-0',
                layout.track
              )}
            >
              {headings.map((heading) => (
                <div
                  key={heading.key}
                  data-depth={heading.depth}
                  data-active={heading.key === activeKey || undefined}
                  aria-hidden
                  className={cn(
                    'bg-ring/50 pointer-events-none h-0.5 w-8 shrink-0 rounded-xs transition-[background-color] duration-200 ease-out',
                    'data-[depth=2]:w-6 data-[depth=3]:w-4',
                    layout.dash,
                    'data-active:bg-foreground'
                  )}
                />
              ))}
            </div>
          }
        />
        <HoverCardContent
          aria-label="Outline"
          className="data-[side=left]:slide-in-from-right-3 data-[side=left]:slide-out-to-right-3 data-[side=right]:slide-in-from-left-3 data-[side=right]:slide-out-to-left-3 data-open:zoom-in-100 data-closed:zoom-out-100 w-56 overflow-hidden p-0 duration-200"
          align="start"
          alignOffset={0}
          side={layout.popup}
          sideOffset={-50}
        >
          <ul className="flex max-h-[50dvh] flex-col overflow-y-auto overscroll-contain p-2">
            {headings.map((heading) => (
              <li key={heading.key} className="flex">
                <Button
                  variant="ghost"
                  size="sm"
                  data-depth={heading.depth}
                  data-active={heading.key === activeKey || undefined}
                  className={cn(
                    'text-muted-foreground hover:text-foreground data-active:text-foreground h-auto w-full justify-start px-2 py-1 text-left font-normal whitespace-normal hover:bg-transparent dark:hover:bg-transparent',
                    'data-[depth=3]:pl-4 data-[depth=4]:pl-8'
                  )}
                  onClick={() => scrollToHeading(editor, heading.key)}
                >
                  <span className="line-clamp-2">
                    {heading.text || 'Untitled heading'}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </HoverCardContent>
      </HoverCard>
    </div>,
    slot
  );
}
