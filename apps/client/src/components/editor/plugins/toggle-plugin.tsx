'use client';

import { Button } from '@conduit/ui/components/button';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import { IconChevronRight } from '@tabler/icons-react';
import {
  $createParagraphNode,
  $getEditor,
  $getNodeByKey,
  $getSelection,
  $hasUpdateTag,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_LOW,
  DELETE_CHARACTER_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  $createToggleContentNode,
  $isToggleContentNode,
  $isToggleNode,
  $isToggleTitleNode,
  ToggleContentNode,
  ToggleNode,
  ToggleTitleNode,
} from '@/components/editor/nodes/toggle-node';
import { cn } from '@/lib/utils';

type Toggle = { slot: HTMLElement; open: boolean };

function ToggleButton({
  editor,
  nodeKey,
  slot,
  open,
}: {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  slot: HTMLElement;
  open: boolean;
}) {
  const editable = useLexicalEditable();
  // A viewer cannot write the document, so their folds stay on their own screen until the document changes.
  const [localOpen, setLocalOpen] = useState(open);
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    setLocalOpen(open);
  }
  const shown = editable ? open : localOpen;

  useEffect(() => {
    const container = slot.parentElement;
    if (container) container.dataset.open = String(shown);
  }, [slot, shown]);

  const toggle = () => {
    if (!editable) {
      setLocalOpen(!localOpen);
      return;
    }
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isToggleNode(node)) node.setOpen(!node.getOpen());
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-expanded={shown}
      aria-label={shown ? 'Collapse' : 'Expand'}
      className="aria-expanded:not-hover:bg-transparent"
      onClick={toggle}
    >
      <IconChevronRight
        className={cn('transition-transform', shown && 'rotate-90')}
      />
    </Button>
  );
}

/** The outermost closed toggle whose folded content holds `node`. */
function $closedToggleAround(node: LexicalNode): ToggleNode | null {
  let found: ToggleNode | null = null;
  for (let parent = node.getParent(); parent; parent = parent.getParent()) {
    const toggle = parent.getParent();
    if (
      $isToggleContentNode(parent) &&
      $isToggleNode(toggle) &&
      !toggle.getOpen()
    ) {
      found = toggle;
    }
  }
  return found;
}

/**
 * Draws each toggle's chevron and keeps every toggle shaped as a title then its content, whatever a paste or
 * a merge from someone else left behind. A toggle at the end of the document keeps a line after it to type on.
 * The caret steps over folded content, so nobody types into text they cannot see.
 */
export function TogglePlugin() {
  const [editor] = useLexicalComposerContext();
  const [toggles, setToggles] = useState<ReadonlyMap<NodeKey, Toggle>>(
    () => new Map()
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerNodeTransform(ToggleNode, (node) => {
        const [title, content, ...extra] = node.getChildren();
        // A selection deleted across the title and the whole content takes the content with it.
        if ($isToggleTitleNode(title) && !content) {
          node.append($createToggleContentNode());
          return;
        }
        if (
          !$isToggleTitleNode(title) ||
          !$isToggleContentNode(content) ||
          extra.length > 0
        ) {
          for (const child of node.getChildren()) node.insertBefore(child);
          node.remove();
          return;
        }
        // Each client would add its own line and the room would keep them all, so only the writer adds it.
        if (
          $isRootNode(node.getParent()) &&
          !node.getNextSibling() &&
          !$hasUpdateTag(COLLABORATION_TAG) &&
          $getEditor().isEditable()
        ) {
          node.insertAfter($createParagraphNode());
        }
      }),
      editor.registerNodeTransform(ToggleTitleNode, (node) => {
        if (!$isToggleNode(node.getParent())) {
          node.replace($createParagraphNode(), true);
        }
      }),
      editor.registerNodeTransform(ToggleContentNode, (node) => {
        if (!$isToggleNode(node.getParent())) {
          for (const child of node.getChildren()) node.insertBefore(child);
          node.remove();
          return;
        }
        if (node.isEmpty()) node.append($createParagraphNode());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          const title = $closedToggleAround(
            selection.anchor.getNode()
          )?.getFirstChild();
          if ($isToggleTitleNode(title)) title.selectEnd();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      ...[KEY_ARROW_RIGHT_COMMAND, KEY_ARROW_DOWN_COMMAND].map((command) =>
        editor.registerCommand(
          command,
          (event) => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
              return false;
            }
            const title = $findMatchingParent(
              selection.anchor.getNode(),
              $isToggleTitleNode
            );
            const toggle = title?.getParent();
            const after = toggle?.getNextSibling();
            const { anchor } = selection;
            const node = anchor.getNode();
            const atEnd =
              command === KEY_ARROW_DOWN_COMMAND ||
              (anchor.type === 'element'
                ? anchor.offset === (title?.getChildrenSize() ?? -1)
                : anchor.offset === node.getTextContentSize() &&
                  !!title?.getLastDescendant()?.is(node));
            if (
              !$isToggleNode(toggle) ||
              toggle.getOpen() ||
              !after ||
              !atEnd
            ) {
              return false;
            }
            // The browser would walk into the folded text, which sits next in the DOM.
            event?.preventDefault();
            after.selectStart();
            return true;
          },
          COMMAND_PRIORITY_LOW
        )
      ),
      editor.registerCommand(
        DELETE_CHARACTER_COMMAND,
        (isBackward) => {
          const selection = $getSelection();
          if (
            !isBackward ||
            !$isRangeSelection(selection) ||
            !selection.isCollapsed() ||
            selection.anchor.offset !== 0
          ) {
            return false;
          }
          const anchor = selection.anchor.getNode();
          const block = $findMatchingParent(
            anchor,
            (node) => $isElementNode(node) && !node.isInline()
          );
          const toggle = block?.getPreviousSibling();
          if (
            !$isElementNode(block) ||
            !(block.is(anchor) || block.getFirstDescendant()?.is(anchor)) ||
            !$isToggleNode(toggle) ||
            toggle.getOpen()
          ) {
            return false;
          }
          // Backspace after a closed toggle joins its title, as it would join a line, instead of the hidden content.
          const title = toggle.getFirstChild();
          if (!$isToggleTitleNode(title)) return false;
          title.selectEnd();
          if ($isParagraphNode(block)) {
            title.append(...block.getChildren());
            block.remove();
          }
          return true;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerMutationListener(
        ToggleNode,
        (mutations) => {
          // Read now, while the state matches these mutations; the updater may run later.
          const changes = editor.getEditorState().read(() =>
            [...mutations].map(([key, mutation]): [NodeKey, Toggle | null] => {
              const node = $getNodeByKey(key);
              const slot = editor
                .getElementByKey(key)
                ?.querySelector<HTMLElement>(':scope > [data-toggle-button]');
              return mutation === 'destroyed' || !$isToggleNode(node) || !slot
                ? [key, null]
                : [key, { slot, open: node.getOpen() }];
            })
          );
          setToggles((previous) => {
            const next = new Map(previous);
            for (const [key, toggle] of changes) {
              if (toggle) next.set(key, toggle);
              else next.delete(key);
            }
            return next;
          });
        },
        { skipInitialization: false }
      )
    );
  }, [editor]);

  return [...toggles].map(([key, { slot, open }]) =>
    createPortal(
      <ToggleButton editor={editor} nodeKey={key} slot={slot} open={open} />,
      slot,
      key
    )
  );
}
