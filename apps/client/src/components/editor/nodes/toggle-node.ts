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

const openState = createState('open', {
  parse: (value) => value !== false,
});

/**
 * A block whose title stays in view and whose content folds away under it. It holds exactly a
 * `ToggleTitleNode` then a `ToggleContentNode`; the toggle plugin repairs any other shape. The plugin draws
 * the chevron into `[data-toggle-button]`.
 */
export class ToggleNode extends ElementNode {
  $config() {
    return this.config('toggle', {
      extends: ElementNode,
      stateConfigs: [{ flat: true, stateConfig: openState }],
    });
  }

  getOpen() {
    return $getState(this, openState);
  }

  setOpen(open: boolean) {
    return $setState(this, openState, open);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const theme = config.theme.toggle ?? {};
    const open = $getState(this, openState, 'direct');
    const element = document.createElement('div');
    addClassNamesToElement(element, theme.base);
    element.dataset.open = String(open);
    const button = document.createElement('span');
    button.contentEditable = 'false';
    button.dataset.toggleButton = '';
    // React draws the chevron here, so the mutation observer must not evict it as unknown DOM.
    setDOMUnmanaged(button, { captureSelection: true });
    addClassNamesToElement(button, theme.button);
    const body = document.createElement('div');
    body.dataset.toggleBody = '';
    addClassNamesToElement(body, theme.body);
    element.append(button, body);
    return element;
  }

  getDOMSlot(element: HTMLElement) {
    return super
      .getDOMSlot(element)
      .withElement(element.querySelector<HTMLElement>('[data-toggle-body]')!);
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    // `getOpen` reads the latest version, which both nodes share, so compare the versions directly.
    const open = $getState(this, openState, 'direct');
    if ($getState(prevNode, openState, 'direct') !== open) {
      dom.dataset.open = String(open);
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('details');
    element.open = this.getOpen();
    return { element };
  }

  canBeEmpty(): false {
    return false;
  }
}

/** The line beside the chevron. Enter in it starts the content when open, or a line after the toggle when not. */
export class ToggleTitleNode extends ElementNode {
  $config() {
    return this.config('toggle-title', { extends: ElementNode });
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.toggle?.title);
    return element;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('summary') };
  }

  insertNewAfter(_: RangeSelection, restoreSelection = true): ParagraphNode {
    const toggle = this.getParent();
    const paragraph = $createParagraphNode();
    const content = this.getNextSibling();
    if (
      $isToggleNode(toggle) &&
      toggle.getOpen() &&
      $isToggleContentNode(content)
    ) {
      const first = content.getFirstChild();
      if (first) first.insertBefore(paragraph, restoreSelection);
      else content.append(paragraph);
      return paragraph;
    }
    (toggle ?? this).insertAfter(paragraph, restoreSelection);
    return paragraph;
  }

  /** Backspace at the start of the title unwraps the toggle into plain blocks. */
  collapseAtStart(): true {
    const toggle = this.getParent();
    const paragraph = $createParagraphNode();
    paragraph.append(...this.getChildren());
    if (!$isToggleNode(toggle)) {
      this.replace(paragraph);
      return true;
    }
    const content = this.getNextSibling();
    const blocks = $isToggleContentNode(content) ? content.getChildren() : [];
    toggle.insertBefore(paragraph);
    for (const block of blocks) toggle.insertBefore(block);
    toggle.remove();
    paragraph.selectStart();
    return true;
  }
}

/** The folding part: any blocks, hidden by CSS while the toggle is closed. */
export class ToggleContentNode extends ElementNode {
  $config() {
    return this.config('toggle-content', { extends: ElementNode });
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    addClassNamesToElement(element, config.theme.toggle?.content);
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isShadowRoot(): true {
    return true;
  }

  canBeEmpty(): false {
    return false;
  }
}

/** A toggle's content with one empty line. */
export function $createToggleContentNode(): ToggleContentNode {
  return $applyNodeReplacement(new ToggleContentNode()).append(
    $createParagraphNode()
  );
}

/** An open toggle with an empty title and one empty line of content. */
export function $createToggleNode(): ToggleNode {
  return $applyNodeReplacement(new ToggleNode()).append(
    $applyNodeReplacement(new ToggleTitleNode()),
    $createToggleContentNode()
  );
}

export function $isToggleNode(
  node: LexicalNode | null | undefined
): node is ToggleNode {
  return node instanceof ToggleNode;
}

export function $isToggleTitleNode(
  node: LexicalNode | null | undefined
): node is ToggleTitleNode {
  return node instanceof ToggleTitleNode;
}

export function $isToggleContentNode(
  node: LexicalNode | null | undefined
): node is ToggleContentNode {
  return node instanceof ToggleContentNode;
}
