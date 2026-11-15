import { CodeNode } from '@lexical/code';
import { $getDocument, type EditorConfig, setDOMUnmanaged } from 'lexical';

/** Where `CodeBlockPlugin` portals the language header and buttons. */
export const CODE_BLOCK_CHROME = '[data-slot="code-block-chrome"]';

function codeOf(figure: HTMLElement) {
  return figure.querySelector<HTMLElement>(
    '[data-slot="code-block-content"] > code'
  )!;
}

/**
 * A code block in the markup of `CodeBlock`, so `styles/code.css` frames it as it frames a sent message.
 * The text stays editable in the inner `<code>`.
 */
export class CodeBlockNode extends CodeNode {
  $config() {
    return this.config('code-block', { extends: CodeNode });
  }

  createDOM(config: EditorConfig) {
    const document = $getDocument();
    const figure = document.createElement('figure');
    figure.className = 'code-block not-typeset';
    figure.dataset.slot = 'code-block';

    const chrome = document.createElement('div');
    chrome.dataset.slot = 'code-block-chrome';
    chrome.contentEditable = 'false';
    // Keeps the caret in the code when a header button is clicked.
    chrome.addEventListener('mousedown', (event) => event.preventDefault());
    setDOMUnmanaged(chrome);

    const panel = document.createElement('div');
    panel.className = 'code-block-panel';
    const pre = document.createElement('pre');
    pre.dir = 'ltr';
    pre.dataset.slot = 'code-block-content';
    pre.append(super.createDOM(config));
    panel.append(pre);

    figure.append(chrome, panel);
    return figure;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig) {
    return super.updateDOM(prevNode, codeOf(dom), config);
  }

  getDOMSlot(element: HTMLElement) {
    return super.getDOMSlot(element).withElement(codeOf(element));
  }
}
