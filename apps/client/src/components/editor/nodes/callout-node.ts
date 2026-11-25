import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $getState,
  $setState,
  createState,
  type DOMExportOutput,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type ParagraphNode,
  type RangeSelection,
  setDOMUnmanaged,
} from 'lexical';

export const CALLOUT_TONES = [
  'blue',
  'green',
  'yellow',
  'red',
  'purple',
  'gray',
] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

const isTone = (value: unknown): value is CalloutTone =>
  CALLOUT_TONES.includes(value as CalloutTone);

const emojiState = createState('emoji', {
  parse: (value) => (typeof value === 'string' && value ? value : '💡'),
});
const toneState = createState('tone', {
  parse: (value): CalloutTone => (isTone(value) ? value : 'blue'),
});

/**
 * A tinted block of text led by an emoji, for a note that should stand out. It holds text like a quote does:
 * Shift+Enter breaks the line, Enter leaves it. The emoji is drawn by the host into `[data-callout-icon]`.
 */
export class CalloutNode extends ElementNode {
  $config() {
    return this.config('callout', {
      extends: ElementNode,
      stateConfigs: [
        { flat: true, stateConfig: emojiState },
        { flat: true, stateConfig: toneState },
      ],
    });
  }

  getEmoji() {
    return $getState(this, emojiState);
  }

  setEmoji(emoji: string) {
    return $setState(this, emojiState, emoji);
  }

  getTone() {
    return $getState(this, toneState);
  }

  setTone(tone: CalloutTone) {
    return $setState(this, toneState, tone);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const theme = config.theme.callout ?? {};
    const element = document.createElement('div');
    addClassNamesToElement(element, theme.base);
    element.dataset.tone = this.getTone();
    const icon = document.createElement('span');
    icon.contentEditable = 'false';
    icon.dataset.calloutIcon = '';
    // React draws the emoji here, so the mutation observer must not evict it as unknown DOM.
    setDOMUnmanaged(icon, { captureSelection: true });
    addClassNamesToElement(icon, theme.icon);
    const body = document.createElement('div');
    body.dataset.calloutBody = '';
    addClassNamesToElement(body, theme.body);
    element.append(icon, body);
    return element;
  }

  getDOMSlot(element: HTMLElement) {
    return super
      .getDOMSlot(element)
      .withElement(element.querySelector<HTMLElement>('[data-callout-body]')!);
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    // `getTone` reads the latest version, which both nodes share, so compare the versions directly.
    const tone = $getState(this, toneState, 'direct');
    if ($getState(prevNode, toneState, 'direct') !== tone) {
      dom.dataset.tone = tone;
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.dataset.callout = this.getTone();
    element.append(`${this.getEmoji()} `);
    return { element };
  }

  insertNewAfter(_: RangeSelection, restoreSelection?: boolean): ParagraphNode {
    const paragraph = $createParagraphNode();
    paragraph.setDirection(this.getDirection());
    this.insertAfter(paragraph, restoreSelection);
    return paragraph;
  }

  collapseAtStart(): true {
    const paragraph = $createParagraphNode();
    this.getChildren().forEach((child) => paragraph.append(child));
    this.replace(paragraph);
    return true;
  }

  canMergeWhenEmpty(): true {
    return true;
  }
}

export function $createCalloutNode(
  emoji = '💡',
  tone: CalloutTone = 'blue'
): CalloutNode {
  return $applyNodeReplacement(new CalloutNode()).setEmoji(emoji).setTone(tone);
}

export function $isCalloutNode(
  node: LexicalNode | null | undefined
): node is CalloutNode {
  return node instanceof CalloutNode;
}
