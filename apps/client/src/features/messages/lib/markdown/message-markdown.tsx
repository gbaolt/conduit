import { memo, use } from 'react';
import type { Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';

import { dom, Markdown } from '@/components/markdown';

import { MentionCard } from '../../components/mention-card';
import { MentionViewer, useMentionName } from '../../context/mention-names';
import { remarkMentions } from './remark-mentions';

// Chat keeps the line breaks people type, and turns <@id> into mentions.
const remarkPlugins = [remarkBreaks, remarkMentions];

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
