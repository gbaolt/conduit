import { memo, use } from 'react';
import Markdown, { type Components } from 'react-markdown';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockWrapButton,
} from '@/components/code-block';
import { MentionCard } from '@/features/messages/components/mention-card';
import {
  MentionViewer,
  useMentionName,
} from '@/features/messages/context/mention-names';

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
  const viewerId = use(MentionViewer);
  const isMember =
    target !== 'channel' && target !== 'here' && name !== '@unknown member';

  return isMember ? (
    <MentionCard userId={target} isViewer={target === viewerId}>
      {name}
    </MentionCard>
  ) : (
    <span className="mention">{name}</span>
  );
}

/** react-markdown passes the syntax tree node as a prop, which must not reach the DOM. */
function dom<T extends { node?: unknown }>({ node, ...props }: T) {
  void node;
  return props;
}

// Typeset styles everything else. These only add behaviour Markdown cannot carry.
const components: Components = {
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

type MessageMarkdownProps = { id: string; updatedAt: Date; body: string };

/** Renders in the browser, because live messages arrive there. Re-renders only when the message changes. */
export const MessageMarkdown = memo(
  function MessageMarkdown({ body }: MessageMarkdownProps) {
    return (
      <div className="typeset typeset-chat max-w-[72ch]">
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
