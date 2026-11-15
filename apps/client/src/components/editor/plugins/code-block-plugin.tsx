import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, type LexicalEditor, type NodeKey } from 'lexical';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  CodeBlockProvider,
  CodeBlockToolbar,
  useCodeBlock,
} from '@/components/code-block';
import {
  CODE_BLOCK_CHROME,
  CodeBlockNode,
} from '@/components/editor/nodes/code-block-node';

type Block = {
  key: NodeKey;
  figure: HTMLElement;
  chrome: HTMLElement;
  code: string;
  language?: string;
};

function readBlocks(editor: LexicalEditor, keys: Iterable<NodeKey>) {
  return editor.getEditorState().read(() =>
    [...keys].flatMap((key): Block[] => {
      const node = $getNodeByKey<CodeBlockNode>(key);
      const figure = editor.getElementByKey(key);
      const chrome = figure?.querySelector<HTMLElement>(CODE_BLOCK_CHROME);
      return node && figure && chrome
        ? [
            {
              key,
              figure,
              chrome,
              code: node.getTextContent(),
              language: node.getLanguage() ?? undefined,
            },
          ]
        : [];
    })
  );
}

/** Lexical owns the figure, so the wrap button's state reaches it here. */
function WrapAttribute({ figure }: { figure: HTMLElement }) {
  const { wrap } = useCodeBlock();

  useEffect(() => {
    figure.toggleAttribute('data-wrap', wrap);
  }, [figure, wrap]);

  return null;
}

/** Gives each `CodeBlockNode` the language header and the wrap and copy buttons of `CodeBlock`. */
export function CodeBlockPlugin() {
  const [editor] = useLexicalComposerContext();
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    const keys = new Set<NodeKey>();
    const sync = () => setBlocks(readBlocks(editor, keys));

    return mergeRegister(
      editor.registerMutationListener(
        CodeBlockNode,
        (mutations) => {
          for (const [key, mutation] of mutations) {
            if (mutation === 'destroyed') keys.delete(key);
            else keys.add(key);
          }
          sync();
        },
        { skipInitialization: false }
      ),
      // Typing changes the code's text nodes, not the block, so the mutation listener misses it.
      editor.registerUpdateListener(({ dirtyElements }) => {
        if ([...keys].some((key) => dirtyElements.has(key))) sync();
      })
    );
  }, [editor]);

  return blocks.map(({ key, figure, chrome, code, language }) =>
    createPortal(
      <CodeBlockProvider>
        <WrapAttribute figure={figure} />
        <CodeBlockToolbar code={code} language={language} />
      </CodeBlockProvider>,
      chrome,
      key
    )
  );
}
