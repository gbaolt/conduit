import { Button } from '@conduit/ui/components/button';
import { $isCodeNode } from '@lexical/code';
import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $setSelection,
  type LexicalEditor,
} from 'lexical';
import { CircleCheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';

import { useDebounce } from '@/components/editor/editor-hooks/use-debounce';

interface Props {
  editor: LexicalEditor;
  getCodeDOMNode: () => HTMLElement | null;
}

export function CopyButton({ editor, getCodeDOMNode }: Props) {
  const [isCopyCompleted, setCopyCompleted] = useState<boolean>(false);

  const removeSuccessIcon = useDebounce(() => {
    setCopyCompleted(false);
  }, 1000);

  async function handleClick(): Promise<void> {
    const codeDOMNode = getCodeDOMNode();

    if (!codeDOMNode) {
      return;
    }

    let content = '';

    editor.update(() => {
      const codeNode = $getNearestNodeFromDOMNode(codeDOMNode);

      if ($isCodeNode(codeNode)) {
        content = codeNode.getTextContent();
      }

      const selection = $getSelection();
      $setSelection(selection);
    });

    try {
      await navigator.clipboard.writeText(content);
      setCopyCompleted(true);
      removeSuccessIcon();
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  return (
    <Button
      size="icon-xs"
      variant="ghost"
      onClick={handleClick}
      aria-label="copy"
    >
      {isCopyCompleted ? (
        <CircleCheckIcon className="size-4" />
      ) : (
        <CopyIcon className="size-4" />
      )}
    </Button>
  );
}
