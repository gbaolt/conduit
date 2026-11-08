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

function ToolbarButton({
  label,
  shortcut,
  pressed,
  className,
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
              'text-muted-foreground size-7 pointer-coarse:size-11',
              pressed && 'bg-accent text-accent-foreground',
              className
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

export function ComposerToolbar({
  length,
  canSend,
  mode,
  onSubmit,
  onCancel,
  setIsLinkEditMode,
}: {
  length: number;
  canSend: boolean;
  mode: 'send' | 'save';
  onSubmit: () => void;
  onCancel?: () => void;
  setIsLinkEditMode: (editing: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const active = useActiveFormats(editor);
  // On a phone the formatting row stays folded until Aa is pressed.
  const [showFormatting, setShowFormatting] = useState(false);

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

  const formatting = (
    <>
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
      <ToolbarButton
        label="Link"
        shortcut="Ctrl+K"
        pressed={active.link}
        onClick={toggleLink}
      >
        <IconLink />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        pressed={active.code}
        onClick={() => format('code')}
      >
        <IconCode />
      </ToolbarButton>
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
      <ToolbarButton
        label="Code block"
        pressed={active.block === 'code'}
        onClick={toggleCodeBlock}
      >
        <IconBraces />
      </ToolbarButton>
    </>
  );

  const overLimit = length > MESSAGE_BODY_MAX;

  return (
    <div className="flex flex-col">
      {showFormatting && (
        <div className="flex flex-wrap items-center gap-0.5 px-1.5 sm:hidden">
          {formatting}
        </div>
      )}
      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        <ToolbarButton
          label="Formatting"
          pressed={showFormatting}
          className="sm:hidden"
          onClick={() => setShowFormatting((shown) => !shown)}
        >
          <IconTextSize />
        </ToolbarButton>
        <div className="hidden items-center gap-0.5 sm:flex">{formatting}</div>
        <EmojiPickerButton
          label="Emoji"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground size-7 pointer-coarse:size-11"
          onPick={(emoji) => insertAtCaret(editor, emoji)}
        >
          <IconMoodSmile />
        </EmojiPickerButton>
        <ToolbarButton
          label="Mention someone"
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
                  size="xs"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                disabled={!canSend}
                onClick={onSubmit}
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon-xs"
              variant={canSend ? 'default' : 'secondary'}
              disabled={!canSend}
              aria-label="Send message"
              className="size-7 pointer-coarse:size-11"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onSubmit}
            >
              <IconSend2 />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
