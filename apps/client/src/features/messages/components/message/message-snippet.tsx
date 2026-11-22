'use client';

import type { MessageFile } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconArrowsDiagonal } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
} from '@/components/code-block';
import {
  SNIPPET_PREVIEW_LINES,
  snippetLanguage,
  snippetPreview,
} from '@/features/messages/lib/snippet-preview';
import { fileTextQuery } from '@/services/files/queries';

/** True once the element has come near the viewport, so a long history fetches only what is read. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && setSeen(true),
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  return [ref, seen] as const;
}

/**
 * A sent text file, shown as its first lines in a code block. Opens the viewer for the rest. Falls back to
 * `fallback`, the plain file card, when the file turns out not to be text.
 */
export function MessageSnippet({
  file,
  onOpen,
  fallback,
}: {
  file: MessageFile;
  onOpen: () => void;
  fallback: ReactNode;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const { data, isError } = useQuery({
    ...fileTextQuery(file.id),
    enabled: seen,
  });
  if (isError) return fallback;

  const preview = data && snippetPreview(data.text, data.truncated);

  return (
    <div ref={ref} className="w-full max-w-xl min-w-0">
      <CodeBlock className="my-0">
        <CodeBlockHeader language={file.name}>
          {data && !data.truncated && <CodeBlockCopyButton value={data.text} />}
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={`Open ${file.name}`}
            onClick={onOpen}
          >
            <IconArrowsDiagonal />
          </Button>
        </CodeBlockHeader>
        {preview ? (
          <CodeBlockContent
            code={preview.code}
            language={snippetLanguage(file.name)}
          />
        ) : (
          <div className="code-block-panel p-4">
            <Skeleton
              className="w-full"
              style={{ height: SNIPPET_PREVIEW_LINES * 10 }}
            />
          </div>
        )}
        {preview?.more && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground mt-1 w-full"
            onClick={onOpen}
          >
            Show all
          </Button>
        )}
      </CodeBlock>
    </div>
  );
}
