/** A sent text file shows this many lines in the message. The viewer shows the rest. */
export const SNIPPET_PREVIEW_LINES = 8;
/** A minified line stops here, so one line cannot stretch the preview's scroll. */
export const SNIPPET_LINE_MAX = 200;

/**
 * The lines a message shows of a text file, and whether anything is left for the viewer. `truncated` is the
 * server's word that the file runs past the part it sent.
 */
export function snippetPreview(text: string, truncated: boolean) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  const shown = lines.slice(0, SNIPPET_PREVIEW_LINES);
  const code = shown
    .map((line) =>
      line.length > SNIPPET_LINE_MAX
        ? `${line.slice(0, SNIPPET_LINE_MAX)}…`
        : line
    )
    .join('\n');
  const more =
    truncated ||
    lines.length > SNIPPET_PREVIEW_LINES ||
    shown.some((line) => line.length > SNIPPET_LINE_MAX);
  return { code, more };
}

/** The highlighter's language for a file, from its extension. Shiki knows `ts`, `py`, and the rest as aliases. */
export function snippetLanguage(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : undefined;
}
