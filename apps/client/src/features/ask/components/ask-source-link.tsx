'use client';

import type { AnswerSource } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { useAsk } from '../context/ask-provider';
import { sourceHref } from '../lib/source-href';

/**
 * Opens a cited source. A guide article opens beside the chat, and everything else navigates to where it lives,
 * calling `onOpen` first. `variant` is the button an article opens through: a citation's link, or a source row.
 */
export function AskSourceLink({
  source,
  onOpen,
  variant,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  source: AnswerSource;
  onOpen: () => void;
  variant: 'link' | 'ghost';
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}) {
  const { openGuide } = useAsk();
  if (source.type === 'guide') {
    return (
      <Button
        variant={variant}
        size={variant === 'link' ? 'xs' : 'default'}
        aria-label={ariaLabel}
        className={cn(
          variant === 'ghost' &&
            'h-auto w-full justify-start text-left font-normal whitespace-normal',
          className
        )}
        onClick={() => openGuide(source.article.slug)}
      >
        {children}
      </Button>
    );
  }
  return (
    <Link
      href={sourceHref(source)}
      onClick={onOpen}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </Link>
  );
}
