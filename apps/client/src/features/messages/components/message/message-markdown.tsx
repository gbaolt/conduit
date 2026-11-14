import { Twemoji } from '@conduit/ui/components/twemoji';
import { usePathname } from 'next/navigation';
import { parseAsString, useQueryStates } from 'nuqs';
import { type ComponentProps, memo, use } from 'react';
import type { Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';

import { dom, Markdown, MarkdownLink } from '@/components/markdown';

import { MentionViewer, useMentionName } from '../../context/mention-names';
import { remarkMentions } from '../../lib/remark-mentions';
import { remarkTwemoji } from '../../lib/remark-twemoji';
import { MentionCard } from '../mention-card';

// Chat keeps the line breaks people type, turns <@id> into mentions, and draws emoji with Twemoji.
const remarkPlugins = [remarkBreaks, remarkMentions, remarkTwemoji];

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

const linkParams = { thread: parseAsString, message: parseAsString };

/**
 * A link to a message in the conversation on screen, such as a shared summary's source, sets `?thread=` and
 * `?message=` through nuqs. A router navigation changes the URL but not the state nuqs holds once the conversation
 * has cleared `?message=`, so a second source would not scroll. Other links navigate as usual.
 */
function MessageLink(props: ComponentProps<'a'>) {
  const { href } = props;
  const pathname = usePathname();
  const [, setLinked] = useQueryStates(linkParams);
  const target =
    href?.startsWith('/') && !href.startsWith('//')
      ? new URL(href, 'http://conduit.local')
      : null;
  const message =
    target?.pathname === pathname ? target.searchParams.get('message') : null;
  if (!target || !message) return <MarkdownLink {...props} />;

  return (
    <a
      {...props}
      onClick={(event) => {
        const newTab =
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey;
        if (newTab) return;
        event.preventDefault();
        void setLinked({ thread: target.searchParams.get('thread'), message });
      }}
    />
  );
}

const components: Components = {
  a: (props) => <MessageLink {...dom(props)} />,
  span: (props) => {
    const {
      'data-mention': target,
      'data-emoji': emoji,
      ...rest
    } = dom(props) as Record<string, unknown>;
    if (emoji !== undefined && typeof rest.children === 'string') {
      return <Twemoji>{rest.children}</Twemoji>;
    }
    return typeof target === 'string' ? (
      <Mention target={target} />
    ) : (
      <span {...rest} />
    );
  },
};

type MessageMarkdownProps = { id: string; updatedAt: Date; body: string };

/** Renders in the browser, because live messages arrive there. Re-renders only when the message changes. */
export const MessageMarkdown = memo(
  function MessageMarkdown({ body }: MessageMarkdownProps) {
    return (
      <Markdown
        className="typeset-chat max-w-[72ch]"
        remarkPlugins={remarkPlugins}
        components={components}
      >
        {body}
      </Markdown>
    );
  },
  (a, b) => a.id === b.id && a.updatedAt.getTime() === b.updatedAt.getTime()
);
