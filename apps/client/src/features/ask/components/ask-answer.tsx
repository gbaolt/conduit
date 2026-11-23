'use client';

import type { AnswerSource } from '@conduit/contract';
import { buttonVariants } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { useMemo } from 'react';
import type { Components } from 'react-markdown';

import { Markdown } from '@/components/markdown';

import { AskSourceLink } from './ask-source-link';

// A `[n]` in the answer becomes a link Markdown keeps, which `citations` below draws as a pill.
const CITE = /\[(\d+)\](?!\()/g;
const CITE_HREF = /^#(?:user-content-)?cite-(\d+)$/;

function citations(
  sources: readonly AnswerSource[],
  onOpen: () => void
): Components {
  return {
    a: ({ href, children }) => {
      const number = Number(href?.match(CITE_HREF)?.[1]);
      const source = sources[number - 1];
      if (!source) return <>{children}</>;
      return (
        <AskSourceLink
          source={source}
          onOpen={onOpen}
          variant="link"
          aria-label={`Source ${number}`}
          className={cn(
            buttonVariants({ size: 'xs', variant: 'link' }),
            'h-auto px-0.5 align-baseline tabular-nums pointer-coarse:inline-flex pointer-coarse:min-h-11'
          )}
        >
          {number}
        </AskSourceLink>
      );
    },
  };
}

/** The answer's Markdown, each `[n]` drawn as a link to its source. */
export function AskAnswer({
  body,
  sources,
  streaming,
  onOpen,
}: {
  body: string;
  sources: readonly AnswerSource[];
  streaming: boolean;
  onOpen: () => void;
}) {
  const components = useMemo(
    () => citations(sources, onOpen),
    [sources, onOpen]
  );
  return (
    <Markdown className="typeset-chat text-sm" components={components}>
      {body.replace(CITE, '[$1](#cite-$1)') + (streaming ? ' ▍' : '')}
    </Markdown>
  );
}
