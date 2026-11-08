import { cn } from '@conduit/ui/lib/utils';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockWrapButton,
} from '@/components/code-block';
import { rehypeCode } from '@/lib/markdown/rehype-code';
import { remarkHtmlAsText } from '@/lib/markdown/remark-html-as-text';
import { sanitizeSchema } from '@/lib/markdown/sanitize-schema';

// Sanitizing comes first so that only the tree Markdown made is checked, and later steps add only what they need.
const rehypePlugins: Options['rehypePlugins'] = [
  [rehypeSanitize, sanitizeSchema],
  rehypeCode,
  [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'nofollow'] }],
];

/** react-markdown passes the syntax tree node as a prop, which must not reach the DOM. */
export function dom<T extends { node?: unknown }>({ node, ...props }: T) {
  void node;
  return props;
}

// Typeset styles everything else. These only add behaviour Markdown cannot carry.
const baseComponents: Components = {
  pre: (props) => {
    const { children, ...rest } = dom(props);
    const { 'data-code': code, 'data-language': language } = rest as Record<
      string,
      unknown
    >;
    if (typeof code !== 'string') return <pre>{children}</pre>;

    const lang = typeof language === 'string' ? language : undefined;
    const actions = (
      <>
        <CodeBlockWrapButton />
        <CodeBlockCopyButton value={code} />
      </>
    );
    return (
      <CodeBlock>
        {lang ? (
          <CodeBlockHeader language={lang}>{actions}</CodeBlockHeader>
        ) : (
          <CodeBlockActions>{actions}</CodeBlockActions>
        )}
        <CodeBlockContent code={code} language={lang} />
      </CodeBlock>
    );
  },
  table: (props) => (
    <div className="typeset-scroll">
      <table {...dom(props)} />
    </div>
  ),
};

export type MarkdownProps = {
  /** Markdown text from anyone. Raw HTML in it shows as text, and nothing in it runs. */
  children: string;
  className?: string;
  /** Extra syntax, run after GFM. Pass a module-level array, so it keeps its identity across renders. */
  remarkPlugins?: NonNullable<Options['remarkPlugins']>;
  /** Elements to draw differently. They override the code block and table. Pass a module-level object. */
  components?: Components;
};

/**
 * Renders untrusted Markdown as HTML: GFM, highlighted code blocks with copy and wrap, scrolling tables,
 * and links that open in a new tab. Sanitizing is not an option, so no caller can turn it off.
 */
export function Markdown({
  children,
  className,
  remarkPlugins = [],
  components,
}: MarkdownProps) {
  return (
    // min-w-0: in a flex parent, a code block's longest line would otherwise set the width.
    <div className={cn('typeset min-w-0', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHtmlAsText, ...remarkPlugins]}
        rehypePlugins={rehypePlugins}
        components={
          components ? { ...baseComponents, ...components } : baseComponents
        }
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
