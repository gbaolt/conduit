'use client';

import { MESSAGE_BODY_MAX } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { cn } from '@conduit/ui/lib/utils';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  type ListType,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $setBlocksType } from '@lexical/selection';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
  IconAt,
  IconBold,
  IconBraces,
  IconCode,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconMoodSmile,
  IconSend2,
  IconStrikethrough,
  IconTextSize,
} from '@tabler/icons-react';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
  type TextFormatType,
} from 'lexical';
import { type ReactNode, useEffect, useState } from 'react';

import { getSelectedNode } from '@/components/editor/utils/get-selected-node';
import { sanitizeUrl } from '@/components/editor/utils/url';

import { EmojiPickerButton } from './emoji-picker';

type Block = 'paragraph' | 'code' | ListType;

type Active = {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  code: boolean;
  link: boolean;
  block: Block;
};

const IDLE: Active = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  link: false,
  block: 'paragraph',
};

function readActive(): Active {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return IDLE;

  const node = getSelectedNode(selection);
  const anchor = selection.anchor.getNode();
  const list = $findMatchingParent(anchor, $isListNode);
  const isCode = $findMatchingParent(anchor, $isCodeNode) !== null;

  return {
    bold: selection.hasFormat('bold'),
    italic: selection.hasFormat('italic'),
    strikethrough: selection.hasFormat('strikethrough'),
    code: selection.hasFormat('code'),
    link: $isLinkNode(node) || $isLinkNode(node.getParent()),
    block: isCode ? 'code' : list ? list.getListType() : 'paragraph',
  };
}

/** Inserts text at the caret. An `@` after a word gets a space first, so it opens the mention menu. */
function insertAtCaret(editor: LexicalEditor, text: string) {
  editor.focus(() =>
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        $getRoot().selectEnd().insertText(text);
        return;
      }
      const before = selection.anchor
        .getNode()
        .getTextContent()
        .slice(0, selection.anchor.offset);
      selection.insertText(text === '@' && /\S$/.test(before) ? ' @' : text);
    })
  );
}

function useActiveFormats(editor: LexicalEditor) {
  const [active, setActive] = useState(IDLE);

  useEffect(() => {
    const update = () => setActive(readActive());
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(update)
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          update();
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor]);

  return active;
}

const FORMAT_BUTTON =
  "text-muted-foreground size-7 pointer-coarse:size-10 [&_svg:not([class*='size-'])]:size-4";
const ACTION_BUTTON =
  "text-muted-foreground size-8 pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-5";

function ToolbarButton({
  label,
  shortcut,
  pressed,
  className = FORMAT_BUTTON,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  pressed?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            aria-pressed={pressed}
            className={cn(
              className,
              pressed && 'bg-accent text-accent-foreground'
            )}
            // Keeps the selection in the editor, so a format applies to what is selected.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? ` (${shortcut})` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

const Divider = () => <span aria-hidden className="bg-border mx-1 h-4 w-px" />;

/** Bold to code block, along the top edge. On a phone it stays folded until Aa opens it. */
export function ComposerFormattingBar({
  open,
  setIsLinkEditMode,
}: {
  open: boolean;
  setIsLinkEditMode: (editing: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const active = useActiveFormats(editor);

  const format = (type: TextFormatType) =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);

  const toggleList = (type: ListType) =>
    editor.dispatchCommand(
      active.block === type
        ? REMOVE_LIST_COMMAND
        : type === 'bullet'
          ? INSERT_UNORDERED_LIST_COMMAND
          : INSERT_ORDERED_LIST_COMMAND,
      undefined
    );

  const toggleCodeBlock = () =>
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () =>
          active.block === 'code' ? $createParagraphNode() : $createCodeNode()
        );
      }
    });

  const toggleLink = () => {
    if (active.link) {
      setIsLinkEditMode(false);
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      setIsLinkEditMode(true);
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitizeUrl('https://'));
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn(
        'border-border/60 flex-wrap items-center gap-0.5 border-b px-1.5 py-1',
        open ? 'flex' : 'hidden sm:flex'
      )}
    >
      <ToolbarButton
        label="Bold"
        shortcut="Ctrl+B"
        pressed={active.bold}
        onClick={() => format('bold')}
      >
        <IconBold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        shortcut="Ctrl+I"
        pressed={active.italic}
        onClick={() => format('italic')}
      >
        <IconItalic />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        shortcut="Ctrl+Shift+X"
        pressed={active.strikethrough}
        onClick={() => format('strikethrough')}
      >
        <IconStrikethrough />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Link"
        shortcut="Ctrl+K"
        pressed={active.link}
        onClick={toggleLink}
      >
        <IconLink />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Bulleted list"
        pressed={active.block === 'bullet'}
        onClick={() => toggleList('bullet')}
      >
        <IconList />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        pressed={active.block === 'number'}
        onClick={() => toggleList('number')}
      >
        <IconListNumbers />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Inline code"
        pressed={active.code}
        onClick={() => format('code')}
      >
        <IconCode />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        pressed={active.block === 'code'}
        onClick={toggleCodeBlock}
      >
        <IconBraces />
      </ToolbarButton>
    </div>
  );
}

/** Emoji and mentions on the left, the length and send on the right, along the bottom edge. */
export function ComposerActionBar({
  length,
  canSend,
  mode,
  formattingOpen,
  onToggleFormatting,
  onSubmit,
  onCancel,
}: {
  length: number;
  canSend: boolean;
  mode: 'send' | 'save';
  formattingOpen: boolean;
  onToggleFormatting: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const overLimit = length > MESSAGE_BODY_MAX;

  return (
    <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
      <ToolbarButton
        label="Formatting"
        pressed={formattingOpen}
        className={cn(ACTION_BUTTON, 'sm:hidden')}
        onClick={onToggleFormatting}
      >
        <IconTextSize />
      </ToolbarButton>
      <EmojiPickerButton
        label="Emoji"
        variant="ghost"
        size="icon-xs"
        className={ACTION_BUTTON}
        onPick={(emoji) => insertAtCaret(editor, emoji)}
      >
        <IconMoodSmile />
      </EmojiPickerButton>
      <ToolbarButton
        label="Mention someone"
        className={ACTION_BUTTON}
        onClick={() => insertAtCaret(editor, '@')}
      >
        <IconAt />
      </ToolbarButton>
      <div className="ml-auto flex items-center gap-2">
        {length >= MESSAGE_BODY_MAX - 200 && (
          <span
            className={cn(
              'text-xs tabular-nums',
              overLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
            aria-live="polite"
          >
            {length.toLocaleString('en-US')} /{' '}
            {MESSAGE_BODY_MAX.toLocaleString('en-US')}
          </span>
        )}
        {mode === 'save' ? (
          <>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={!canSend}
              onClick={onSubmit}
            >
              Save
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            variant={canSend ? 'default' : 'secondary'}
            disabled={!canSend}
            aria-label="Send message"
            className="size-8 pointer-coarse:size-11"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onSubmit}
          >
            <IconSend2 />
          </Button>
        )}
      </div>
    </div>
  );
}
