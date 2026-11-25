'use client';

import { Button } from '@conduit/ui/components/button';
import { ButtonGroup } from '@conduit/ui/components/button-group';
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
import { $findMatchingParent, $getNearestNodeOfType } from '@lexical/utils';
import { IconChevronDown, IconMoodSmile, IconPlus } from '@tabler/icons-react';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  type LexicalEditor,
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
      className="bg-popover text-popover-foreground pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-md border p-1 shadow-md"
    >
      {modal}
      <DropdownMenu>
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
      <DropdownMenu>
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
      <ButtonGroup>
        <EmojiPicker
          aria-label="Insert emoji"
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
      </ButtonGroup>
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
