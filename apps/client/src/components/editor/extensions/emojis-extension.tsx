import { EMOJI_PATTERN } from '@conduit/ui/components/twemoji';
import { defineExtension, TextNode } from 'lexical';

import {
  $createEmojiNode,
  EmojiNode,
} from '@/components/editor/nodes/emoji-node';

function $findAndTransformEmoji(node: TextNode): null | TextNode {
  const match = EMOJI_PATTERN.exec(node.getTextContent());
  if (!match) return null;

  const end = match.index + match[0].length;
  const targetNode =
    match.index === 0
      ? node.splitText(end)[0]
      : node.splitText(match.index, end)[1];
  if (!targetNode) return null;

  // Bold around the emoji must survive, or the Markdown export splits the run.
  const emojiNode = $createEmojiNode('emoji', match[0]).setFormat(
    targetNode.getFormat()
  );
  targetNode.replace(emojiNode);
  return emojiNode;
}

function $textNodeTransform(node: TextNode): void {
  let targetNode: TextNode | null = node;

  while (targetNode !== null) {
    // Code stays as typed, as it does in a sent message.
    if (!targetNode.isSimpleText() || targetNode.hasFormat('code')) {
      return;
    }

    targetNode = $findAndTransformEmoji(targetNode);
  }
}

/** Turns each emoji typed, pasted, or picked into an `EmojiNode`, which draws it with Twemoji. */
export const EmojisExtension = defineExtension({
  name: '@shadcn-editor/Emojis',
  nodes: [EmojiNode],
  register: (editor) =>
    editor.registerNodeTransform(TextNode, $textNodeTransform),
});
