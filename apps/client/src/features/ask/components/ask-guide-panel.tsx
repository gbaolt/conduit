'use client';

import type { AskGuideArticle } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Skeleton } from '@conduit/ui/components/skeleton';
import { IconArrowLeft, IconBook } from '@tabler/icons-react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { Markdown } from '@/components/markdown';
import { askGuideQuery } from '@/services/ask/queries';

import { useAsk } from '../context/ask-provider';

function GuideBody({ article }: { article: UseQueryResult<AskGuideArticle> }) {
  if (article.data) {
    return (
      <Markdown className="typeset-chat text-sm">{article.data.body}</Markdown>
    );
  }
  if (article.isError) {
    return (
      <p className="text-muted-foreground text-sm">{article.error.message}</p>
    );
  }
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

/** A cited article of the Conduit guide, over the chat until Back returns to it. */
export function AskGuidePanel({ slug }: { slug: string }) {
  const { closeGuide } = useAsk();
  const article = useQuery(askGuideQuery(slug));

  return (
    <section
      aria-labelledby="ask-guide-title"
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        closeGuide();
      }}
    >
      <header className="flex min-h-12 shrink-0 items-center gap-1 border-b px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to Ask Conduit"
          className="pointer-coarse:size-11"
          autoFocus
          onClick={closeGuide}
        >
          <IconArrowLeft />
        </Button>
        <h2
          id="ask-guide-title"
          className="flex min-w-0 flex-1 items-center gap-2 font-semibold"
        >
          <IconBook aria-hidden className="size-4 shrink-0" />
          <span className="truncate">
            {article.data?.title ?? 'Conduit guide'}
          </span>
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          Conduit guide
        </p>
        <GuideBody article={article} />
      </div>
    </section>
  );
}
