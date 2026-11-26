import { EMOJI_PATTERN } from '@conduit/ui/components/twemoji';
import type { ElementTransformer } from '@lexical/markdown';
import { $createLineBreakNode, $createTextNode } from 'lexical';

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
  // Every quote line matches, so a callout's later lines can join it; `replace` hands plain quotes back.
  regExp: new RegExp(
    `^>\\s?(?:(${EMOJI_PATTERN.source})(?:\\s|$))?`,
    EMOJI_PATTERN.flags
  ),
  replace: (parentNode, children, match, isImport) => {
    const previous = parentNode.getPreviousSibling();
    // Export separates blocks with a blank line, so a quote line straight after a callout is its next line.
    if (isImport && $isCalloutNode(previous)) {
      const lead = (match[0] ?? '').replace(/^>\s?/, '');
      previous.append(
        $createLineBreakNode(),
        ...(lead ? [$createTextNode(lead)] : []),
        ...children
      );
      parentNode.remove();
      return;
    }
    if (!match[1]) return false;
    const callout = $createCalloutNode(match[1]);
    callout.append(...children);
    parentNode.replace(callout);
  },
  type: 'element',
};
