'use client';

import { Button } from '@conduit/ui/components/button';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { mergeRegister } from '@lexical/utils';
import { IconChevronRight } from '@tabler/icons-react';
import {
  $createParagraphNode,
  $getNodeByKey,
  $isRootNode,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
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
  // A viewer cannot write the document, so their folds stay on their own screen.
  const [localOpen, setLocalOpen] = useState(open);
  const shown = editable ? open : localOpen;

  const toggle = () => {
    if (editable) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isToggleNode(node)) node.setOpen(!node.getOpen());
      });
      return;
    }
    const container = slot.parentElement;
    if (container) container.dataset.open = String(!localOpen);
    setLocalOpen(!localOpen);
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-expanded={shown}
      aria-label={shown ? 'Collapse' : 'Expand'}
      onClick={toggle}
    >
      <IconChevronRight
        className={cn('transition-transform', shown && 'rotate-90')}
      />
    </Button>
  );
}

/**
 * Draws each toggle's chevron and keeps every toggle shaped as a title then its content, whatever a paste or
 * a merge from someone else left behind. A toggle at the end of the document keeps a line after it to type on.
 */
export function TogglePlugin() {
  const [editor] = useLexicalComposerContext();
  const [toggles, setToggles] = useState<ReadonlyMap<NodeKey, Toggle>>(
    () => new Map()
  );

  useEffect(
    () =>
      mergeRegister(
        editor.registerNodeTransform(ToggleNode, (node) => {
          const [title, content, ...extra] = node.getChildren();
          if (
            !$isToggleTitleNode(title) ||
            !$isToggleContentNode(content) ||
            extra.length > 0
          ) {
            for (const child of node.getChildren()) node.insertBefore(child);
            node.remove();
            return;
          }
          if ($isRootNode(node.getParent()) && !node.getNextSibling()) {
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
        editor.registerMutationListener(
          ToggleNode,
          (mutations) =>
            setToggles((previous) => {
              const next = new Map(previous);
              editor.getEditorState().read(() => {
                for (const [key, mutation] of mutations) {
                  const node = $getNodeByKey(key);
                  const slot = editor
                    .getElementByKey(key)
                    ?.querySelector<HTMLElement>(
                      ':scope > [data-toggle-button]'
                    );
                  if (
                    mutation === 'destroyed' ||
                    !$isToggleNode(node) ||
                    !slot
                  ) {
                    next.delete(key);
                  } else {
                    next.set(key, { slot, open: node.getOpen() });
                  }
                }
              });
              return next;
            }),
          { skipInitialization: false }
        )
      ),
    [editor]
  );

  return [...toggles].map(([key, { slot, open }]) =>
    createPortal(
      <ToggleButton editor={editor} nodeKey={key} slot={slot} open={open} />,
      slot,
      key
    )
  );
}
