'use client';

import { MESSAGE_BODY_MAX } from '@conduit/contract';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { buildEditorFromExtensions } from '@lexical/extension';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionEditorComposer } from '@lexical/react/LexicalExtensionEditorComposer';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { ReactProviderExtension } from '@lexical/react/ReactProviderExtension';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  configExtension,
  FORMAT_TEXT_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_MODIFIER_COMMAND,
  type LexicalEditorWithDispose,
} from 'lexical';
import {
  type ReactNode,
  type RefObject,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import { CodeHighlightPlugin } from '@/components/editor/plugins/code-highlight-plugin';
import { EmojiPickerPlugin } from '@/components/editor/plugins/emoji-picker-plugin';
import { FloatingLinkEditorPlugin } from '@/components/editor/plugins/floating-link-editor-plugin';
import {
  Mention,
  MentionAvatar,
  MentionContent,
  MentionHint,
  MentionItem,
  MentionLabel,
  MentionPortal,
} from '@/components/editor/plugins/mention';
import { TabFocusPlugin } from '@/components/editor/plugins/tab-focus-plugin';
import { sanitizeUrl } from '@/components/editor/utils/url';

import { MentionNames, MentionSuggestions } from '../../context/mention-names';
import {
  createComposerExtension,
  markdownOf,
} from '../../lib/composer-extension';
import { ComposerActionBar, ComposerFormattingBar } from './composer-toolbar';

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
  /** Controls in the bottom bar, before Send, such as a thread's "Also send to channel" checkbox. */
  actions?: ReactNode;
  /** Rendered under the frame, such as the edit hint. */
  children?: ReactNode;
};

const FENCE = /^```([\w-]*)$/;

/** Turns a paragraph that is only a fence, such as ```ts, into a code block, as the toolbar would. */
function $openCodeFence() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const paragraph = selection.anchor.getNode().getTopLevelElement();
  if (!$isParagraphNode(paragraph)) return false;
  const fence = FENCE.exec(paragraph.getTextContent());
  if (!fence) return false;
  const code = $createCodeNode(fence[1] || undefined);
  paragraph.replace(code);
  code.select();
  return true;
}

/** Down arrow on a code block's last line leaves it, adding a paragraph when nothing follows the block. */
function $exitCodeBlock() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const { anchor } = selection;
  const code = anchor.getNode().getTopLevelElement();
  if (!$isCodeNode(code) || code.getNextSibling()) return false;
  const after =
    anchor.getNode() === code
      ? code.getChildren().slice(anchor.offset)
      : anchor.getNode().getNextSiblings();
  if (after.some($isLineBreakNode)) return false;
  const paragraph = $createParagraphNode();
  code.insertAfter(paragraph);
  paragraph.select();
  return true;
}

// On a phone Enter adds a line, and only the send button sends.
const isCoarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

function ComposerBehavior({
  placeholder,
  mode,
  autoFocus,
  anchor,
  isLinkEditMode,
  setIsLinkEditMode,
  initialMarkdown,
  menuOpen,
  onSubmit,
  onCancel,
  onEditLast,
  onChange,
  actions,
}: Required<Pick<ComposerProps, 'mode' | 'placeholder'>> &
  Pick<
    ComposerProps,
    | 'autoFocus'
    | 'onSubmit'
    | 'onCancel'
    | 'onEditLast'
    | 'onChange'
    | 'initialMarkdown'
    | 'actions'
  > & {
    anchor: HTMLDivElement | null;
    menuOpen: RefObject<boolean>;
    isLinkEditMode: boolean;
    setIsLinkEditMode: (editing: boolean) => void;
  }) {
  const [editor] = useLexicalComposerContext();
  const suggestions = use(MentionSuggestions);
  const [markdown, setMarkdown] = useState(initialMarkdown ?? '');
  const [formattingOpen, setFormattingOpen] = useState(false);
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
          // The mention menu takes Enter to pick a person.
          if (!event || event.isComposing || menuOpen.current) return false;
          if ($openCodeFence()) {
            event.preventDefault();
            return true;
          }
          // Shift+Enter starts a new paragraph, so `- `, `1. `, and `# ` convert at the start of each line.
          if (event.shiftKey) {
            event.preventDefault();
            return editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
          }

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
          if (!canCancel || menuOpen.current) return false;
          event.preventDefault();
          handleCancel();
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (menuOpen.current || !$exitCodeBlock()) return false;
          event.preventDefault();
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
  }, [editor, canCancel, canEditLast, menuOpen, setIsLinkEditMode]);

  return (
    <>
      <CodeHighlightPlugin />
      <TabFocusPlugin />
      <Mention
        source={suggestions}
        onOpenChange={(open) => {
          menuOpen.current = open;
        }}
      >
        <MentionPortal>
          <MentionContent>
            {() => (
              <MentionItem>
                <MentionAvatar />
                <MentionLabel />
                <MentionHint />
              </MentionItem>
            )}
          </MentionContent>
        </MentionPortal>
      </Mention>
      <EmojiPickerPlugin
        onOpenChange={(open) => {
          menuOpen.current = open;
        }}
      />
      <FloatingLinkEditorPlugin
        anchorElem={anchor}
        isLinkEditMode={isLinkEditMode}
        setIsLinkEditMode={setIsLinkEditMode}
      />
      <ComposerFormattingBar
        open={formattingOpen}
        setIsLinkEditMode={setIsLinkEditMode}
      />
      <ComposerEditable placeholder={placeholder} />
      <ComposerActionBar
        length={markdown.length}
        canSend={canSend}
        mode={mode}
        formattingOpen={formattingOpen}
        onToggleFormatting={() => setFormattingOpen((open) => !open)}
        onSubmit={submit}
        onCancel={onCancel}
      >
        {actions}
      </ComposerActionBar>
    </>
  );
}

function ComposerEditable({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative">
      <ContentEditable
        aria-label={placeholder}
        aria-placeholder={placeholder}
        placeholder={
          <div className="text-muted-foreground pointer-events-none absolute top-[11px] left-3 text-sm leading-[23px] select-none">
            {placeholder}
          </div>
        }
        className="max-h-[40dvh] min-h-11 overflow-y-auto px-3 py-[10.5px] text-sm leading-[23px] outline-none"
      />
    </div>
  );
}

const disposedEditors = new WeakSet<LexicalEditorWithDispose>();

// The bars render around the editable, so the extension does not render its own.
function buildComposerEditor(
  markdown: string,
  names: ReadonlyMap<string, string>
) {
  return buildEditorFromExtensions(
    ReactProviderExtension,
    configExtension(ReactExtension, { contentEditable: null }),
    createComposerExtension(markdown, names)
  );
}

/**
 * The one composer for a channel, a DM, a thread, and editing a sent message. Its value is Markdown text.
 * Enter sends and Shift+Enter starts a new line. Inside a list or code block Enter continues it.
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
  const latest = useRef(initialMarkdown ?? '');
  const menuOpen = useRef(false);
  const [editor, setEditor] = useState(() =>
    buildComposerEditor(latest.current, namesAtMount)
  );

  // Every effect cleanup disposes the editor, including a hidden route's, and a disposed editor ignores typing.
  // So an effect that finds its editor disposed builds a new one from the latest text.
  useEffect(() => {
    if (disposedEditors.has(editor)) {
      setEditor(buildComposerEditor(latest.current, namesAtMount));
      return;
    }
    return () => {
      editor.dispose();
      disposedEditors.add(editor);
    };
  }, [editor, namesAtMount]);

  const { onChange } = behavior;
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);

  return (
    <div>
      <div
        ref={setAnchor}
        className="border-input bg-surface relative flex flex-col rounded-lg border shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
      >
        <LexicalExtensionEditorComposer
          key={editor.getKey()}
          initialEditor={editor}
        >
          <ComposerBehavior
            {...behavior}
            onChange={(markdown) => {
              latest.current = markdown;
              onChange?.(markdown);
            }}
            placeholder={placeholder}
            mode={mode}
            initialMarkdown={latest.current}
            menuOpen={menuOpen}
            anchor={anchor}
            isLinkEditMode={isLinkEditMode}
            setIsLinkEditMode={setIsLinkEditMode}
          />
        </LexicalExtensionEditorComposer>
      </div>
      {children}
    </div>
  );
}
