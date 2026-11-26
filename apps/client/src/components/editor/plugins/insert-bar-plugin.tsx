'use client';

import { Button } from '@conduit/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerTrigger,
} from '@conduit/ui/components/emoji-picker';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { $isCodeNode } from '@lexical/code';
import { $isListNode, ListNode } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import {
  $findMatchingParent,
  $getNearestNodeOfType,
  mergeRegister,
} from '@lexical/utils';
import { IconChevronDown, IconMoodSmile, IconPlus } from '@tabler/icons-react';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  FOCUS_COMMAND,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useEditorModal } from '@/components/editor/editor-hooks/use-modal';
import { $isCalloutNode } from '@/components/editor/nodes/callout-node';
import type { ComponentPickerOption } from '@/components/editor/plugins/picker/component-picker-option';

/** The block styles the text menu offers, by the `/` option each one runs. */
const STYLES = [
  { type: 'paragraph', option: 'Paragraph', label: 'Text' },
  { type: 'h1', option: 'Heading 1', label: 'Heading 1' },
  { type: 'h2', option: 'Heading 2', label: 'Heading 2' },
  { type: 'h3', option: 'Heading 3', label: 'Heading 3' },
  { type: 'bullet', option: 'Bulleted List', label: 'Bulleted list' },
  { type: 'number', option: 'Numbered List', label: 'Numbered list' },
  { type: 'check', option: 'Check List', label: 'Check list' },
  { type: 'quote', option: 'Quote', label: 'Quote' },
  { type: 'callout', option: 'Callout', label: 'Callout' },
  { type: 'code', option: 'Code', label: 'Code' },
] as const;

type BlockType = (typeof STYLES)[number]['type'];

function $blockType(): BlockType {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return 'paragraph';
  const anchor = selection.anchor.getNode();
  const list = $getNearestNodeOfType(anchor, ListNode);
  if ($isListNode(list)) return list.getListType();
  const block = $findMatchingParent(anchor, (node) => {
    const parent = node.getParent();
    return parent !== null && $isRootOrShadowRoot(parent);
  });
  if ($isHeadingNode(block)) {
    const tag = block.getTag();
    return tag === 'h1' || tag === 'h2' || tag === 'h3' ? tag : 'paragraph';
  }
  if ($isQuoteNode(block)) return 'quote';
  if ($isCalloutNode(block)) return 'callout';
  if ($isCodeNode(block)) return 'code';
  return 'paragraph';
}

/**
 * A toolbar click blurs the document, which keeps its selection. With none yet the caret goes to the end; with
 * a block such as a divider selected, to the line after it.
 */
function $ensureSelection() {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) return;
  const block = selection?.getNodes()[0]?.getTopLevelElement();
  if (!block) {
    $getRoot().selectEnd();
    return;
  }
  const next =
    block.getNextSibling() ?? block.insertAfter($createParagraphNode());
  next.selectStart();
}

function InsertBarButton({
  label,
  render,
  children,
}: {
  label: string;
  render: ReactElement;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={render} aria-label={label}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// Lexical scrolls the caret into view as it commits, so a scroll this soon after an update came from typing.
const TYPING_SCROLL_MS = 150;

function scrollParentOf(element: HTMLElement | null): HTMLElement | Window {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
  }
  return window;
}

/** The line the caret is on: its nearest block, so each list item counts as its own line. */
function $caretLine(): NodeKey | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const block = $findMatchingParent(
    selection.anchor.getNode(),
    (node) => $isElementNode(node) && !node.isInline()
  );
  return block?.getKey() ?? null;
}

/**
 * Whether the bar shows: while the caret is in the document or the person is using the bar. Scrolling the page
 * puts it away until the person moves to another line or clicks in the document again.
 */
function useInsertBarShown(editor: LexicalEditor) {
  const [editorFocused, setEditorFocused] = useState(
    () => !!editor.getRootElement()?.contains(document.activeElement ?? null)
  );
  const [scrolledAway, setScrolledAway] = useState(false);

  useEffect(() => {
    let lastUpdate = 0;
    // The line the caret was on when a scroll put the bar away, or undefined while it is out.
    let awayFrom: NodeKey | null | undefined;
    const putAway = () => {
      awayFrom = editor.getEditorState().read($caretLine);
      setScrolledAway(true);
    };
    const bringBack = () => {
      awayFrom = undefined;
      setScrolledAway(false);
    };
    const onScroll = () => {
      if (performance.now() - lastUpdate >= TYPING_SCROLL_MS) putAway();
    };
    const scrollParent = scrollParentOf(editor.getRootElement());
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    let root: HTMLElement | null = null;
    const unregister = mergeRegister(
      editor.registerRootListener((next, previous) => {
        previous?.removeEventListener('pointerdown', bringBack);
        next?.addEventListener('pointerdown', bringBack);
        root = next;
      }),
      editor.registerUpdateListener(({ editorState }) => {
        lastUpdate = performance.now();
        if (
          awayFrom !== undefined &&
          editorState.read($caretLine) !== awayFrom
        ) {
          bringBack();
        }
      }),
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          setEditorFocused(true);
          bringBack();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          setEditorFocused(false);
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
    return () => {
      scrollParent.removeEventListener('scroll', onScroll);
      root?.removeEventListener('pointerdown', bringBack);
      unregister();
    };
  }, [editor]);

  return { editorFocused, scrolledAway };
}

function InsertBar({
  editor,
  options,
  quick,
}: {
  editor: LexicalEditor;
  options: readonly ComponentPickerOption[];
  quick: readonly string[];
}) {
  const [modal, showModal] = useEditorModal();
  const { editorFocused, scrolledAway } = useInsertBarShown(editor);
  // Focus and hover reach here from the bar's menus too, since React bubbles through portals.
  const [barFocused, setBarFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menu = (name: string) => (open: boolean) =>
    setOpenMenu((current) => {
      if (open) return name;
      return current === name ? null : current;
    });
  const shown =
    openMenu !== null ||
    ((editorFocused || barFocused || hovered) && !scrolledAway);
  const [blockType, setBlockType] = useState<BlockType>(() =>
    editor.getEditorState().read($blockType)
  );
  // A pick leaves focus in the document; Escape hands it back to the trigger.
  const picked = useRef(false);
  const finalFocus = () => {
    const back = !picked.current;
    picked.current = false;
    return back;
  };

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) =>
        setBlockType(editorState.read($blockType))
      ),
    [editor]
  );

  // Focus first, so an option that opens a dialog leaves the dialog holding focus.
  const run = (option: ComponentPickerOption | undefined) => {
    if (!option) return;
    picked.current = true;
    editor.update($ensureSelection, { discrete: true });
    editor.focus();
    option.onSelect('', editor, showModal);
  };
  const byTitle = (title: string) =>
    options.find((option) => option.title === title);
  const styles = STYLES.filter(({ option }) => byTitle(option));
  const current = STYLES.find(({ type }) => type === blockType) ?? STYLES[0];

  return (
    <div
      role="toolbar"
      aria-label="Insert"
      data-hidden={shown ? undefined : ''}
      inert={!shown}
      onFocus={() => setBarFocused(true)}
      onBlur={() => setBarFocused(false)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="bg-popover text-popover-foreground pointer-events-auto flex max-w-full items-center rounded-md border p-1 shadow-md transition-[opacity,translate,scale] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] data-hidden:pointer-events-none data-hidden:translate-y-2 data-hidden:scale-95 data-hidden:opacity-0 data-hidden:delay-500 motion-reduce:transition-none"
    >
      {modal}
      <DropdownMenu onOpenChange={menu('insert')}>
        <InsertBarButton
          label="Insert a block"
          render={
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            />
          }
        >
          <IconPlus />
        </InsertBarButton>
        <DropdownMenuContent
          side="top"
          className="w-56"
          finalFocus={finalFocus}
        >
          {options.map((option) => (
            <DropdownMenuItem key={option.key} onClick={() => run(option)}>
              {option.icon}
              {option.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu onOpenChange={menu('style')}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Text style: ${current.label}`}
              className="shrink-0"
            />
          }
        >
          {current.label}
          <IconChevronDown data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          className="w-44"
          finalFocus={finalFocus}
        >
          <DropdownMenuRadioGroup value={blockType}>
            {styles.map(({ type, option, label }) => (
              <DropdownMenuRadioItem
                key={type}
                value={type}
                closeOnClick
                onClick={() => run(byTitle(option))}
              >
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <EmojiPicker
        aria-label="Insert emoji"
        onOpenChange={menu('emoji')}
        onEmojiSelect={({ value }) => {
          picked.current = true;
          editor.update(() => {
            $ensureSelection();
            const selection = $getSelection();
            if ($isRangeSelection(selection)) selection.insertText(value);
          });
          editor.focus();
        }}
      >
        <InsertBarButton
          label="Emoji"
          render={<EmojiPickerTrigger variant="ghost" size="icon-sm" />}
        >
          <IconMoodSmile />
        </InsertBarButton>
        <EmojiPickerContent side="top" finalFocus={finalFocus} />
      </EmojiPicker>
      {quick.map((title) => {
        const option = byTitle(title);
        return (
          option && (
            <InsertBarButton
              key={title}
              label={title}
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => run(option)}
                />
              }
            >
              {option.icon ?? <IconPlus />}
            </InsertBarButton>
          )
        );
      })}
    </div>
  );
}

/**
 * A bar along the bottom of the document with the `/` menu's blocks behind `+`, the line's style, emoji and a
 * few common blocks, for people who never type `/`. It renders into `slot`, which the host places.
 */
export function InsertBarPlugin({
  slot,
  options,
  quick,
}: {
  slot: HTMLElement | null;
  options: readonly ComponentPickerOption[];
  /** Titles of the options that get their own button. */
  quick: readonly string[];
}) {
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  return (
    slot &&
    editable &&
    createPortal(
      <InsertBar editor={editor} options={options} quick={quick} />,
      slot
    )
  );
}
