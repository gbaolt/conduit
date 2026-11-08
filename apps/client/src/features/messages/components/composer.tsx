'use client';

import { MESSAGE_BODY_MAX } from '@conduit/contract';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_MODIFIER_COMMAND,
} from 'lexical';
import {
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';

import { CodeHighlightPlugin } from '@/components/editor/plugins/code-highlight-plugin';
import { FloatingLinkEditorPlugin } from '@/components/editor/plugins/floating-link-editor-plugin';
import { MentionsPlugin } from '@/components/editor/plugins/mentions-plugin';
import { TabFocusPlugin } from '@/components/editor/plugins/tab-focus-plugin';
import { sanitizeUrl } from '@/components/editor/utils/url';

import { MentionNames, MentionSuggestions } from '../context/mention-names';
import { createComposerExtension, markdownOf } from '../lib/composer-extension';
import { ComposerToolbar } from './composer-toolbar';

export type ComposerProps = {
  placeholder: string;
  /** Markdown to start with. Read once, when the composer mounts. */
  initialMarkdown?: string;
  /** `send` clears the composer after submitting. `save` is for editing a sent message in place. */
  mode?: 'send' | 'save';
  autoFocus?: boolean;
  onSubmit: (markdown: string) => void;
  /** Escape. Also adds a Cancel button when `mode` is `save`. */
  onCancel?: () => void;
  /** Up arrow in an empty composer. */
  onEditLast?: () => void;
  /** The Markdown after each change, such as typing, a paste, or the composer clearing after a send. */
  onChange?: (markdown: string) => void;
  /** Rendered under the frame, such as a thread's "Also send to channel" checkbox. */
  children?: ReactNode;
};

// On a phone Enter adds a line, and only the send button sends.
const isCoarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

function ComposerBehavior({
  mode,
  autoFocus,
  anchor,
  isLinkEditMode,
  setIsLinkEditMode,
  initialMarkdown,
  onSubmit,
  onCancel,
  onEditLast,
  onChange,
}: Required<Pick<ComposerProps, 'mode'>> &
  Pick<
    ComposerProps,
    | 'autoFocus'
    | 'onSubmit'
    | 'onCancel'
    | 'onEditLast'
    | 'onChange'
    | 'initialMarkdown'
  > & {
    anchor: HTMLDivElement | null;
    isLinkEditMode: boolean;
    setIsLinkEditMode: (editing: boolean) => void;
  }) {
  const [editor] = useLexicalComposerContext();
  const suggestions = use(MentionSuggestions);
  const [markdown, setMarkdown] = useState(initialMarkdown ?? '');
  const canSend =
    markdown.trim().length > 0 && markdown.length <= MESSAGE_BODY_MAX;

  const handleChange = useEffectEvent((next: string) => onChange?.(next));

  useEffect(() => {
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
        const next = markdownOf(editor);
        setMarkdown(next);
        handleChange(next);
      }
    });
  }, [editor]);

  useEffect(() => {
    if (autoFocus) editor.focus();
  }, [autoFocus, editor]);

  const submit = () => {
    const text = markdownOf(editor).trim();
    if (!text || text.length > MESSAGE_BODY_MAX) return;
    onSubmit(text);
    if (mode === 'send') {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      });
      setMarkdown('');
    }
  };

  // Effect events let the registered handlers call the latest props without re-registering.
  const handleSubmit = useEffectEvent(submit);
  const handleCancel = useEffectEvent(() => onCancel?.());
  const handleEditLast = useEffectEvent(() => onEditLast?.());
  const canCancel = Boolean(onCancel);
  const canEditLast = Boolean(onEditLast);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!event || event.isComposing || event.shiftKey) return false;

          const modifier = event.ctrlKey || event.metaKey;
          if (!modifier) {
            if (isCoarsePointer()) return false;
            // Enter continues a list or a code block. Ctrl+Enter sends from inside either.
            const selection = $getSelection();
            const inBlock =
              $isRangeSelection(selection) &&
              selection.anchor
                .getNode()
                .getParents()
                .some((parent) =>
                  ['listitem', 'code'].includes(parent.getType())
                );
            if (inBlock) return false;
          }

          event.preventDefault();
          queueMicrotask(handleSubmit);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (!canCancel) return false;
          event.preventDefault();
          handleCancel();
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (!canEditLast || $getRoot().getTextContentSize() > 0) return false;
          event.preventDefault();
          handleEditLast();
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_MODIFIER_COMMAND,
        (event) => {
          const key = event.key.toLowerCase();
          if (key === 'k' && !event.shiftKey) {
            event.preventDefault();
            setIsLinkEditMode(true);
            return editor.dispatchCommand(
              TOGGLE_LINK_COMMAND,
              sanitizeUrl('https://')
            );
          }
          if (key === 'x' && event.shiftKey) {
            event.preventDefault();
            return editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor, canCancel, canEditLast, setIsLinkEditMode]);

  return (
    <>
      <CodeHighlightPlugin />
      <TabFocusPlugin />
      <MentionsPlugin source={suggestions} />
      <FloatingLinkEditorPlugin
        anchorElem={anchor}
        isLinkEditMode={isLinkEditMode}
        setIsLinkEditMode={setIsLinkEditMode}
      />
      <ComposerToolbar
        length={markdown.length}
        canSend={canSend}
        mode={mode}
        onSubmit={submit}
        onCancel={onCancel}
        setIsLinkEditMode={setIsLinkEditMode}
      />
    </>
  );
}

function ComposerEditable({ placeholder }: { placeholder: string }) {
  return (
    <ContentEditable
      aria-label={placeholder}
      aria-placeholder={placeholder}
      placeholder={
        <div className="text-muted-foreground pointer-events-none absolute top-[11px] left-3 text-sm leading-[22px] select-none">
          {placeholder}
        </div>
      }
      className="max-h-[40dvh] min-h-11 overflow-y-auto px-3 py-[11px] text-sm leading-[22px] outline-none"
    />
  );
}

/**
 * The one composer for a channel, a DM, a thread, and editing a sent message. Its value is Markdown text.
 * Enter sends and Shift+Enter adds a line. Inside a list or code block Enter continues it.
 */
export function Composer({
  placeholder,
  initialMarkdown,
  mode = 'send',
  children,
  ...behavior
}: ComposerProps) {
  // Names only label the mentions in `initialMarkdown`, so a later members refresh must not rebuild the editor.
  const [namesAtMount] = useState(use(MentionNames));
  const extension = useMemo(
    () => createComposerExtension(initialMarkdown ?? '', namesAtMount),
    [initialMarkdown, namesAtMount]
  );
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);

  return (
    <div>
      <div
        ref={setAnchor}
        className="border-input bg-background focus-within:border-ring focus-within:ring-ring/50 relative flex flex-col rounded-lg border shadow-[0_1px_3px_rgb(0_0_0/0.08)] focus-within:ring-3"
      >
        <LexicalExtensionComposer
          extension={extension}
          contentEditable={<ComposerEditable placeholder={placeholder} />}
        >
          <ComposerBehavior
            {...behavior}
            mode={mode}
            initialMarkdown={initialMarkdown}
            anchor={anchor}
            isLinkEditMode={isLinkEditMode}
            setIsLinkEditMode={setIsLinkEditMode}
          />
        </LexicalExtensionComposer>
      </div>
      {children}
    </div>
  );
}
