import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents';
import {
  DecoratorBlockNode,
  type SerializedDecoratorBlockNode,
} from '@lexical/react/LexicalDecoratorBlockNode';
import type {
  EditorConfig,
  ElementFormatType,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  Spread,
} from 'lexical';
import { createContext, type JSX, type ReactNode, use } from 'react';

/**
 * Only the message's id: the text is loaded for each viewer with their own access, so a message they cannot
 * read never reaches the shared document.
 */
export type SerializedMessageEmbedNode = Spread<
  { messageId: string },
  SerializedDecoratorBlockNode
>;

/** Draws an embedded message. The editor's host provides it, since the editor kit cannot load messages. */
export const MessageEmbedRenderer = createContext<
  (messageId: string) => ReactNode
>(() => null);

function MessageEmbedBlock({
  className,
  format,
  nodeKey,
  messageId,
}: {
  className: { base: string; focus: string };
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  messageId: string;
}) {
  const render = use(MessageEmbedRenderer);
  return (
    <BlockWithAlignableContents
      className={className}
      format={format}
      nodeKey={nodeKey}
    >
      {render(messageId)}
    </BlockWithAlignableContents>
  );
}

export class MessageEmbedNode extends DecoratorBlockNode {
  __messageId: string;

  static getType(): string {
    return 'message-embed';
  }

  static clone(node: MessageEmbedNode): MessageEmbedNode {
    return new MessageEmbedNode(node.__messageId, node.__format, node.__key);
  }

  static importJSON(serialized: SerializedMessageEmbedNode): MessageEmbedNode {
    return $createMessageEmbedNode(serialized.messageId).updateFromJSON(
      serialized
    );
  }

  constructor(messageId: string, format?: ElementFormatType, key?: NodeKey) {
    super(format, key);
    this.__messageId = messageId;
  }

  exportJSON(): SerializedMessageEmbedNode {
    return { ...super.exportJSON(), messageId: this.__messageId };
  }

  getMessageId(): string {
    return this.__messageId;
  }

  updateDOM(): false {
    return false;
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const theme = config.theme.embedBlock ?? {};
    return (
      <MessageEmbedBlock
        className={{ base: theme.base ?? '', focus: theme.focus ?? '' }}
        format={this.__format}
        nodeKey={this.getKey()}
        messageId={this.__messageId}
      />
    );
  }
}

export function $createMessageEmbedNode(messageId: string) {
  return new MessageEmbedNode(messageId);
}

export function $isMessageEmbedNode(
  node: LexicalNode | null | undefined
): node is MessageEmbedNode {
  return node instanceof MessageEmbedNode;
}
