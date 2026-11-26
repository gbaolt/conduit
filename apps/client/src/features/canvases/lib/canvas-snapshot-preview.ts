import { buildEditorFromExtensions } from '@lexical/extension';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { ReactProviderExtension } from '@lexical/react/ReactProviderExtension';
import {
  configExtension,
  defineExtension,
  type LexicalEditorWithDispose,
} from 'lexical';

import { type CanvasContent, createCanvasExtension } from './canvas-extension';

function buildCanvasPreviewEditor(
  content: CanvasContent,
  names: ReadonlyMap<string, string>
): LexicalEditorWithDispose {
  const editor = buildEditorFromExtensions(
    ReactProviderExtension,
    configExtension(ReactExtension, { contentEditable: null }),
    defineExtension({
      name: '@conduit/canvas-snapshot-preview',
      editable: false,
      dependencies: [
        createCanvasExtension(content, names, {
          writeHeadingDomIds: false,
        }),
      ],
    })
  );
  try {
    // Flush any pending initial state callback (such as markdown seeding) so parse errors are caught here.
    editor.read(() => {});
  } catch (error) {
    editor.dispose();
    throw error;
  }
  return editor;
}

/**
 * Builds a read-only preview editor from a saved Postgres snapshot, falling back to Markdown
 * if the stored snapshot JSON is malformed, and returning `null` if no valid preview can be built.
 */
export function tryBuildCanvasPreviewEditor(
  content: CanvasContent,
  names: ReadonlyMap<string, string>
): LexicalEditorWithDispose | null {
  if (content.snapshotJson !== null) {
    try {
      return buildCanvasPreviewEditor(
        { snapshotJson: content.snapshotJson, markdown: '' },
        names
      );
    } catch {
      // Fall through to markdown when stored snapshot JSON is malformed or uses unknown nodes.
    }
  }

  if (content.markdown.length > 0) {
    try {
      return buildCanvasPreviewEditor(
        { snapshotJson: null, markdown: content.markdown },
        names
      );
    } catch {
      return null;
    }
  }

  return null;
}
