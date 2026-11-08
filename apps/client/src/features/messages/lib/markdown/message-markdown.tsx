import { cn } from '@conduit/ui/lib/utils';
import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockWrapButton,
} from '@/components/code-block';
import { useMentionName } from '@/features/messages/context/mention-names';

import { rehypeCode } from './rehype-code';
import { remarkHtmlAsText } from './remark-html-as-text';
import { remarkMentions } from './remark-mentions';
import { sanitizeSchema } from './sanitize-schema';

const remarkPlugins = [
  remarkGfm,
  remarkBreaks,
  remarkHtmlAsText,
  remarkMentions,
];

// Sanitizing comes first so that only the tree Markdown made is checked, and later steps add only what they need.
const rehypePlugins: React.ComponentProps<typeof Markdown>['rehypePlugins'] = [
  [rehypeSanitize, sanitizeSchema],
  rehypeCode,
  [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'nofollow'] }],
];

function Mention({ target }: { target: string }) {
  const name = useMentionName(target);
  return (
    <span className="bg-primary/10 text-primary rounded-sm px-0.5 font-medium">
      {name}
    </span>
  );
}

/** react-markdown passes the syntax tree node as a prop, which must not reach the DOM. */
function dom<T extends { node?: unknown }>({ node, ...props }: T) {
  void node;
  return props;
}

/** A chat row never shows a 24 px title, so every heading is a bold paragraph. */
const Heading: Components['h1'] = (props) => (
  <p {...dom(props)} className="font-semibold" />
);

const components: Components = {
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  a: (props) => (
    <a
      {...dom(props)}
      className="text-primary underline-offset-2 hover:underline"
    />
  ),
  span: (props) => {
    const { 'data-mention': target, ...rest } = dom(props) as Record<
      string,
      unknown
    >;
    return typeof target === 'string' ? (
      <Mention target={target} />
    ) : (
      <span {...rest} />
    );
  },
  code: (props) => {
    const { className, ...rest } = dom(props);
    return (
      <code
        {...rest}
        className={cn(
          !className?.startsWith('language-') &&
            'bg-muted rounded-sm px-1 py-0.5 font-mono text-[13px]',
          className
        )}
      />
    );
  },
  pre: (props) => {
    const { children, ...rest } = dom(props);
    const { 'data-code': code, 'data-language': language } = rest as Record<
      string,
      unknown
    >;
    if (typeof code !== 'string') return <pre>{children}</pre>;

    const lang = typeof language === 'string' ? language : undefined;
    return (
      <CodeBlock>
        <CodeBlockHeader language={lang}>
          <CodeBlockWrapButton />
          <CodeBlockCopyButton value={code} />
        </CodeBlockHeader>
        <CodeBlockContent code={code} language={lang} />
      </CodeBlock>
    );
  },
  blockquote: (props) => (
    <blockquote {...dom(props)} className="border-border border-l-[3px] pl-3" />
  ),
  ul: (props) => <ul {...dom(props)} className="list-disc pl-5" />,
  ol: (props) => <ol {...dom(props)} className="list-decimal pl-5" />,
  table: (props) => (
    <div className="overflow-x-auto">
      <table {...dom(props)} className="border-collapse text-left" />
    </div>
  ),
  th: (props) => (
    <th
      {...dom(props)}
      className="border-border border px-2 py-1 font-semibold"
    />
  ),
  td: (props) => (
    <td {...dom(props)} className="border-border border px-2 py-1" />
  ),
};

type MessageMarkdownProps = { id: string; updatedAt: Date; body: string };

/** Renders in the browser, because live messages arrive there. Re-renders only when the message changes. */
export const MessageMarkdown = memo(
  function MessageMarkdown({ body }: MessageMarkdownProps) {
    return (
      <div className="max-w-[72ch] text-sm leading-[22px] wrap-break-word [&>*+*]:mt-1.5">
        <Markdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {body}
        </Markdown>
      </div>
    );
  },
  (a, b) => a.id === b.id && a.updatedAt.getTime() === b.updatedAt.getTime()
);
