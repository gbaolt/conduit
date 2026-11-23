'use client';

import { Button } from '@conduit/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@conduit/ui/components/empty';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@conduit/ui/components/message-scroller';
import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import { ConversationLoading } from '@/features/messages/components/conversation/conversation-loading';
import { askChatQuery } from '@/services/ask/queries';

import { useAsk } from '../context/ask-provider';
import { AskTurnItem, type AskTurnView } from './ask-turn';

function AskEmpty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: typeof IconSparkles;
  title: string;
  children: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

/** The chat's stored turns, oldest first, then the question in flight. */
export function AskTranscript({ onOpenSource }: { onOpenSource: () => void }) {
  const { chatId, turn, send, startChat } = useAsk();
  const chat = useQuery({ ...askChatQuery(chatId ?? ''), enabled: !!chatId });

  if (chatId && chat.isPending) return <ConversationLoading />;
  if (chatId && chat.isError) {
    return (
      <AskEmpty
        icon={IconAlertTriangle}
        title="Couldn't load this chat"
        action={
          <Button variant="outline" size="sm" onClick={() => startChat(null)}>
            New chat
          </Button>
        }
      >
        It may have been deleted, or the connection dropped.
      </AskEmpty>
    );
  }

  const turns: AskTurnView[] = [
    ...(chat.data?.answers ?? []).map((answer) => ({
      ...answer,
      status: 'done' as const,
    })),
    ...(turn ? [turn] : []),
  ];
  if (turns.length === 0) {
    return (
      <AskEmpty icon={IconSparkles} title="Ask Conduit">
        Answers from the channels, messages and files you can open. Direct
        messages stay out, and only you see the chat.
      </AskEmpty>
    );
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label="Ask Conduit chat">
          <MessageScrollerContent className="gap-6 px-5 py-4">
            {turns.map((item, index) => (
              <MessageScrollerItem
                key={item.status === 'done' ? item.id : 'in-flight'}
                messageId={item.status === 'done' ? item.id : 'in-flight'}
                scrollAnchor
              >
                <AskTurnItem
                  turn={item}
                  latest={index === turns.length - 1}
                  onOpenSource={onOpenSource}
                  onRetry={() => send(item.question, item.attachments)}
                  onNewChat={() => startChat(null)}
                />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
