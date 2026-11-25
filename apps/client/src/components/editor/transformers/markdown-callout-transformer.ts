import { EMOJI_PATTERN } from '@conduit/ui/components/twemoji';
import type { ElementTransformer } from '@lexical/markdown';

import {
  $createCalloutNode,
  $isCalloutNode,
  CalloutNode,
} from '@/components/editor/nodes/callout-node';

/**
 * A callout reads as a quote led by its emoji, `> 💡 Note`, which search and AI understand. Only import and
 * export use it: in the editor, `> 😀 ` still starts a plain quote.
 */
export const CALLOUT: ElementTransformer = {
  dependencies: [CalloutNode],
  export: (node, exportChildren) => {
    if (!$isCalloutNode(node)) return null;
    const [first, ...rest] = exportChildren(node).split('\n');
    return [
      `> ${node.getEmoji()} ${first}`,
      ...rest.map((line) => `> ${line}`),
    ].join('\n');
  },
  regExp: new RegExp(`^>\\s(${EMOJI_PATTERN.source})\\s`, EMOJI_PATTERN.flags),
  replace: (parentNode, children, match) => {
    const callout = $createCalloutNode(match[1]);
    callout.append(...children);
    parentNode.replace(callout);
  },
  type: 'element',
};
