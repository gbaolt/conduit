'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { CodeBlockNode } from '@/components/editor/nodes/code-block-node';

const CodeHighlightPlugin = dynamic(
  () =>
    import('./code-highlight-plugin').then(
      (module) => module.CodeHighlightPlugin
    ),
  { ssr: false }
);

/** Mounts Shiki once the editor has a code block, so prose-only editors never download it. */
export function LazyCodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  const [hasCodeBlocks, setHasCodeBlocks] = useState(false);

  useEffect(() => {
    if (hasCodeBlocks) return;
    return editor.registerMutationListener(
      CodeBlockNode,
      (mutations) => {
        for (const mutation of mutations.values()) {
          if (mutation !== 'destroyed') {
            setHasCodeBlocks(true);
            return;
          }
        }
      },
      { skipInitialization: false }
    );
  }, [editor, hasCodeBlocks]);

  return hasCodeBlocks && <CodeHighlightPlugin />;
}
