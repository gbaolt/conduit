'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@conduit/ui/components/popover';
import { cn } from '@conduit/ui/lib/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode, HeadingNode } from '@lexical/rich-text';
import { IconLink, IconList } from '@tabler/icons-react';
import {
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $nodesOfType,
  type ElementNode,
  HISTORY_MERGE_TAG,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { $isToggleNode } from '@/components/editor/nodes/toggle-node';
import { OPEN_TOGGLE_ANCESTORS_COMMAND } from '@/components/editor/plugins/toggle-plugin';
import { useCopy } from '@/hooks/use-copy';

import {
  $getHeadingAnchorId,
  $setHeadingAnchorId,
  assignHeadingAnchors,
  type CanvasHeading,
  createHeadingAnchorId,
  findHeadingByAnchor,
  headingAnchorFromHash,
  headingAnchorOf,
  headingUrlOf,
  sameHeadings,
} from '../lib/canvas-heading-anchor';

/** A heading counts as passed once its top scrolls within this distance of the top of the canvas. */
const ACTIVE_OFFSET_PX = 96;

function $collectHeadings(node: ElementNode, out: HeadingNode[]) {
  for (const child of node.getChildren()) {
    if ($isHeadingNode(child)) {
      out.push(child);
    } else if ($isElementNode(child)) {
      $collectHeadings(child, out);
    }
  }
}

function $readHeadings(): CanvasHeading[] {
  const nodes: HeadingNode[] = [];
  $collectHeadings($getRoot(), nodes);
  return assignHeadingAnchors(
    nodes.map((node) => ({
      key: node.getKey(),
      text: node.getTextContent(),
      anchorId: $getHeadingAnchorId(node),
      depth: Math.min(Number(node.getTag().slice(1)), 3),
    }))
  );
}

/** One walk of the document per edit, shared by the outline and the hash scroll. */
export function useCanvasHeadings(editor: LexicalEditor) {
  const [headings, setHeadings] = useState(() => editor.read($readHeadings));

  useEffect(
    () =>
      editor.registerUpdateListener(
        ({ editorState, dirtyElements, dirtyLeaves }) => {
          if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
          const next = editorState.read($readHeadings);
          // Most edits leave the outline as it was, so they must not re-render it.
          setHeadings((current) =>
            sameHeadings(current, next) ? current : next
          );
        }
      ),
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
    let frame = 0;
    const update = () => {
      frame = 0;
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
        if (
          element &&
          element.getClientRects().length > 0 &&
          element.getBoundingClientRect().top <= line
        ) {
          active = heading.key;
        }
      }
      setActiveKey(active);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', schedule);
    };
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

function openCollapsedTogglesFor(editor: LexicalEditor, key: NodeKey) {
  if (!editor.isEditable()) {
    editor.dispatchCommand(OPEN_TOGGLE_ANCESTORS_COMMAND, key);
    return;
  }
  editor.update(
    () => {
      let current = $getNodeByKey(key)?.getParent() ?? null;
      while (current) {
        if ($isToggleNode(current) && !current.getOpen()) {
          current.setOpen(true);
        }
        current = current.getParent();
      }
    },
    { discrete: true, tag: HISTORY_MERGE_TAG }
  );
}

function scrollToHeading(editor: LexicalEditor, key: NodeKey, instant = false) {
  openCollapsedTogglesFor(editor, key);
  const reduceMotion =
    instant || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const element = editor.getElementByKey(key);
  if (!element) return false;
  element.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });
  return true;
}

type NavigationLike = EventTarget;

function getWindowNavigation(): NavigationLike | null {
  if (typeof window === 'undefined') return null;
  const nav = (window as Window & { navigation?: NavigationLike }).navigation;
  return nav && typeof nav.addEventListener === 'function' ? nav : null;
}

/**
 * Subscribes to fragment changes without monkey-patching History methods. Uses the Navigation API when
 * available and falls back to `hashchange`/`popstate`, deferring callbacks out of history mutations.
 */
function subscribeToHash(onHashChange: (nextHash: string) => void) {
  let lastHash = window.location.hash;
  let cancelled = false;

  const handleChange = () => {
    const nextHash = window.location.hash;
    if (nextHash === lastHash) return;
    lastHash = nextHash;
    queueMicrotask(() => {
      if (!cancelled) onHashChange(nextHash);
    });
  };

  const navigation = getWindowNavigation();
  if (navigation) {
    navigation.addEventListener('currententrychange', handleChange);
    return () => {
      cancelled = true;
      navigation.removeEventListener('currententrychange', handleChange);
    };
  }

  window.addEventListener('hashchange', handleChange);
  window.addEventListener('popstate', handleChange);
  return () => {
    cancelled = true;
    window.removeEventListener('hashchange', handleChange);
    window.removeEventListener('popstate', handleChange);
  };
}

/**
 * Stays mounted across version previews so Back/Forward hash changes queue while hidden and scroll once the
 * live editor is visible again. Never settles a non-empty hash until initial content is ready.
 */
export function CanvasTocHashScroll({
  headings,
  ready,
  visible,
}: {
  headings: CanvasHeading[];
  ready: boolean;
  visible: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash
  );
  const settledHashRef = useRef<string | null>(null);

  useEffect(() => editor.registerRootListener(setRoot), [editor]);

  useEffect(() => {
    settledHashRef.current = null;
  }, [editor]);

  useEffect(
    () =>
      subscribeToHash((nextHash) => {
        settledHashRef.current = null;
        setHash(nextHash);
      }),
    []
  );

  useEffect(() => {
    if (!ready || !visible || !root) return;
    if (settledHashRef.current === hash) return;
    const anchor = headingAnchorFromHash(hash);
    if (!anchor) {
      settledHashRef.current = hash;
      return;
    }
    const match = findHeadingByAnchor(headings, anchor);
    const frame = requestAnimationFrame(() => {
      const target =
        match ?? findHeadingByAnchor(editor.read($readHeadings), anchor);
      if (!target) {
        settledHashRef.current = hash;
        return;
      }
      if (scrollToHeading(editor, target.key, true)) {
        settledHashRef.current = hash;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editor, ready, visible, root, headings, hash]);

  return null;
}

function CanvasTocList({
  headings,
  activeKey,
  onSelect,
  onCopyLink,
}: {
  headings: CanvasHeading[];
  activeKey: NodeKey | null;
  onSelect: (key: NodeKey) => void;
  onCopyLink: (heading: CanvasHeading) => void;
}) {
  return (
    <ul className="flex max-h-[50dvh] flex-col overflow-y-auto overscroll-contain p-2">
      {headings.map((heading) => {
        const label = heading.text || 'Untitled heading';
        return (
          <li
            key={heading.key}
            className="group/toc-item flex items-center gap-1"
          >
            <Button
              variant="ghost"
              size="sm"
              data-depth={heading.depth}
              data-active={heading.key === activeKey || undefined}
              className={cn(
                'text-muted-foreground hover:text-foreground data-active:text-foreground h-auto min-w-0 flex-1 justify-start px-2 py-1 text-left font-normal whitespace-normal hover:bg-transparent dark:hover:bg-transparent',
                'data-[depth=2]:pl-3 data-[depth=3]:pl-5'
              )}
              onClick={() => onSelect(heading.key)}
            >
              <span className="line-clamp-2">{label}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Copy link to ${label}`}
              className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 transition-opacity group-focus-within/toc-item:opacity-100 group-hover/toc-item:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={() => onCopyLink(heading)}
            >
              <IconLink />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The canvas outline, drawn into `slot` (wide aside) and `compactSlot` (narrow header chrome): a labelled
 * button opens a popover list of headings where each item jumps to the heading or copies its link. Renders
 * nothing while the canvas has no headings.
 */
export function CanvasToc({
  headings,
  slot,
  compactSlot,
  side,
}: {
  headings: CanvasHeading[];
  slot: HTMLElement | null;
  compactSlot: HTMLElement | null;
  side: keyof typeof SIDES;
}) {
  const [editor] = useLexicalComposerContext();
  const activeKey = useActiveHeading(editor, headings);
  const [wideOpen, setWideOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const { copy } = useCopy({
    onCopySuccess: () => toast.success('Heading link copied.'),
    onCopyError: () => toast.error('Couldn’t copy link.'),
  });

  if (headings.length === 0) return null;
  const layout = SIDES[side];
  const copyLink = (heading: CanvasHeading) => {
    let anchor = heading.anchor;
    if (!heading.anchorId && editor.isEditable()) {
      let assignedId: string | null = null;
      // Normal persisted edit (not HISTORY_MERGE) so autosave and live sync store the new ID.
      editor.update(
        () => {
          const node = $getNodeByKey(heading.key);
          if (!$isHeadingNode(node)) return;
          const existing = $getHeadingAnchorId(node);
          if (existing) {
            assignedId = existing;
            return;
          }
          const used = new Set<string>();
          for (const other of $nodesOfType(HeadingNode)) {
            const otherId = $getHeadingAnchorId(other);
            if (otherId) used.add(otherId);
          }
          const nextId = createHeadingAnchorId(used);
          $setHeadingAnchorId(node, nextId);
          assignedId = nextId;
        },
        { discrete: true }
      );
      if (assignedId) {
        anchor = headingAnchorOf(heading.text, assignedId);
      }
    }
    void copy(() => headingUrlOf(window.location.href, anchor));
  };

  return (
    <>
      {slot &&
        createPortal(
          <div className={cn('w-18', layout.root)}>
            <Popover open={wideOpen} onOpenChange={setWideOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    aria-label="Outline"
                    className={cn(
                      'h-auto max-h-[50dvh] w-full flex-col gap-3 overflow-hidden rounded-md py-3 opacity-100 transition-opacity duration-200 hover:bg-transparent data-popup-open:opacity-0 dark:hover:bg-transparent',
                      layout.track
                    )}
                  />
                }
              >
                {headings.map((heading) => (
                  <span
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
              </PopoverTrigger>
              <PopoverContent
                aria-label="Outline"
                className="w-56 overflow-hidden rounded-md p-0"
                align="start"
                alignOffset={0}
                side={layout.popup}
                sideOffset={-50}
              >
                <CanvasTocList
                  headings={headings}
                  activeKey={activeKey}
                  onSelect={(key) => {
                    setWideOpen(false);
                    scrollToHeading(editor, key);
                  }}
                  onCopyLink={copyLink}
                />
              </PopoverContent>
            </Popover>
          </div>,
          slot
        )}
      {compactSlot &&
        createPortal(
          <Popover open={compactOpen} onOpenChange={setCompactOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Outline"
                  className="bg-background/80 hover:bg-muted"
                />
              }
            >
              <IconList />
            </PopoverTrigger>
            <PopoverContent
              aria-label="Outline"
              align="end"
              className="w-56 overflow-hidden rounded-md p-0"
            >
              <CanvasTocList
                headings={headings}
                activeKey={activeKey}
                onSelect={(key) => {
                  setCompactOpen(false);
                  scrollToHeading(editor, key);
                }}
                onCopyLink={copyLink}
              />
            </PopoverContent>
          </Popover>,
          compactSlot
        )}
    </>
  );
}
