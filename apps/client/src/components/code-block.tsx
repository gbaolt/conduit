'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { cn } from '@conduit/ui/lib/utils';
import { IconCheck, IconCopy, IconTextWrap } from '@tabler/icons-react';
import {
  type ComponentProps,
  createContext,
  type Dispatch,
  type SetStateAction,
  use,
  useEffect,
  useState,
} from 'react';

const CodeBlockContext = createContext<{
  wrap: boolean;
  setWrap: Dispatch<SetStateAction<boolean>>;
} | null>(null);

function useCodeBlock() {
  const context = use(CodeBlockContext);
  if (!context) throw new Error('Use this inside a CodeBlock.');
  return context;
}

/** A framed code listing. Compose `CodeBlockHeader` and `CodeBlockContent` inside it. */
export function CodeBlock({
  className,
  children,
  ...props
}: ComponentProps<'figure'>) {
  const [wrap, setWrap] = useState(false);

  return (
    <CodeBlockContext value={{ wrap, setWrap }}>
      <figure
        {...props}
        data-slot="code-block"
        className={cn(
          'border-border bg-background my-1.5 flex min-w-0 flex-col overflow-hidden rounded-md border',
          className
        )}
      >
        {children}
      </figure>
    </CodeBlockContext>
  );
}

export function CodeBlockHeader({
  language,
  children,
}: {
  language?: string;
  children?: React.ReactNode;
}) {
  return (
    <figcaption
      data-slot="code-block-header"
      className="border-border bg-muted/50 text-muted-foreground flex min-h-9 items-center gap-2 border-b py-1 pr-1 pl-3 font-mono text-xs"
    >
      <span className="min-w-0 flex-1 truncate">{language}</span>
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </figcaption>
  );
}

export function CodeBlockWrapButton() {
  const { wrap, setWrap } = useCodeBlock();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label="Wrap lines"
            aria-pressed={wrap}
            onClick={() => setWrap((current) => !current)}
          />
        }
      >
        <IconTextWrap />
      </TooltipTrigger>
      <TooltipContent>{wrap ? 'Stop wrapping' : 'Wrap lines'}</TooltipContent>
    </Tooltip>
  );
}

const COPIED_MS = 1500;

export function CodeBlockCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={copied ? 'Copied' : 'Copy code'}
            onClick={() => {
              navigator.clipboard.writeText(value).then(
                () => setCopied(true),
                () => undefined
              );
            }}
          />
        }
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied' : 'Copy code'}</TooltipContent>
    </Tooltip>
  );
}

type Token = {
  content: string;
  htmlStyle?: Record<string, string>;
};

const MAX_CACHED = 200;
const tokenCache = new Map<string, Token[][]>();

/**
 * Highlights with Shiki, loaded on first use. Resolves to null for a language Shiki does not know,
 * so the block keeps showing plain text.
 */
async function highlight(code: string, language: string) {
  const key = `${language}\0${code}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;

  const { bundledLanguages, codeToTokens } = await import('shiki');
  if (!(language in bundledLanguages)) return null;

  const { tokens } = await codeToTokens(code, {
    lang: language as keyof typeof bundledLanguages,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
  if (tokenCache.size >= MAX_CACHED) {
    tokenCache.delete(tokenCache.keys().next().value!);
  }
  tokenCache.set(key, tokens);
  return tokens;
}

/** The code, as plain text until its language has loaded. */
export function CodeBlockContent({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  const { wrap } = useCodeBlock();
  const [highlighted, setHighlighted] = useState<{
    key: string;
    tokens: Token[][];
  } | null>(null);
  const key = `${language}\0${code}`;

  useEffect(() => {
    if (!language) return;
    let current = true;
    highlight(code, language).then(
      (tokens) => current && tokens && setHighlighted({ key, tokens }),
      () => undefined
    );
    return () => {
      current = false;
    };
  }, [code, key, language]);

  const tokens = highlighted?.key === key ? highlighted.tokens : null;

  return (
    <pre
      dir="ltr"
      tabIndex={0}
      data-slot="code-block-content"
      className={cn(
        'focus-visible:ring-ring/50 max-h-[360px] overflow-auto overscroll-x-contain py-2.5 text-start font-mono text-[13px] leading-5 outline-none focus-visible:ring-3',
        wrap && '[overflow-wrap:anywhere] whitespace-pre-wrap'
      )}
    >
      <code className={cn('block px-3', !wrap && 'w-max min-w-full')}>
        {tokens
          ? tokens.map((line, index) => (
              <span key={index} className="block min-h-5">
                {line.map((token, tokenIndex) => (
                  <span
                    key={tokenIndex}
                    className="text-(--shiki-light) dark:text-(--shiki-dark)"
                    style={token.htmlStyle}
                  >
                    {token.content}
                  </span>
                ))}
              </span>
            ))
          : code}
      </code>
    </pre>
  );
}
