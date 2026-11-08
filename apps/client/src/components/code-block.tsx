'use client';

import { Button } from '@conduit/ui/components/button';
import { cn } from '@conduit/ui/lib/utils';
import { IconTextWrap } from '@tabler/icons-react';
import {
  type ComponentProps,
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useEffect,
  useState,
} from 'react';

import { CopyButton } from './copy-button';

const CodeBlockContext = createContext<{
  wrap: boolean;
  setWrap: Dispatch<SetStateAction<boolean>>;
} | null>(null);

function useCodeBlock() {
  const context = use(CodeBlockContext);
  if (!context) throw new Error('Use this inside a CodeBlock.');
  return context;
}

/**
 * A framed code listing, styled by `styles/code.css`. Compose `CodeBlockHeader` or `CodeBlockActions`,
 * then `CodeBlockContent`, inside it.
 */
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
        data-wrap={wrap || undefined}
        className={cn('code-block not-typeset', className)}
      >
        {children}
      </figure>
    </CodeBlockContext>
  );
}

/** The language and the actions. Without a header, `CodeBlockActions` floats in the corner on hover. */
export function CodeBlockHeader({
  language,
  children,
}: {
  language: string;
  children?: ReactNode;
}) {
  return (
    <figcaption data-slot="code-block-header">
      <span data-slot="code-block-title">{language}</span>
      <CodeBlockActions>{children}</CodeBlockActions>
    </figcaption>
  );
}

export function CodeBlockActions({ children }: { children: ReactNode }) {
  return <div data-slot="code-block-actions">{children}</div>;
}

const actionClassName =
  "text-muted-foreground [&_svg:not([class*='size-'])]:size-4";

export function CodeBlockWrapButton() {
  const { wrap, setWrap } = useCodeBlock();

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={actionClassName}
      aria-label="Wrap lines"
      aria-pressed={wrap}
      onClick={() => setWrap((current) => !current)}
    >
      <IconTextWrap />
    </Button>
  );
}

export function CodeBlockCopyButton({ value }: { value: string }) {
  return (
    <CopyButton
      variant="ghost"
      size="icon-xs"
      className={actionClassName}
      aria-label="Copy code"
      text={value}
    />
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
    <div className="code-block-panel">
      <pre dir="ltr" tabIndex={0} data-slot="code-block-content">
        <code>
          {(
            tokens ??
            code.split('\n').map((line): Token[] => [{ content: line }])
          ).map((line, index) => (
            <span key={index} data-line="">
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} style={token.htmlStyle}>
                  {token.content}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
