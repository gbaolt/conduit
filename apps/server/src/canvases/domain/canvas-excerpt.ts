import { CANVAS_LINK_EXCERPT_MAX } from '@conduit/contract';

const SOURCE_LIMIT = 8192;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const entities = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', '\u00a0'],
]);

function decodeEntity(entity: string, token: string) {
  if (!entity.startsWith('#'))
    return entities.get(entity.toLowerCase()) ?? token;

  const hex = entity[1]?.toLowerCase() === 'x';
  const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
  if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    return '\ufffd';
  }
  return String.fromCodePoint(code);
}

function afterLinkDestination(text: string, start: number) {
  let depth = 1;
  let quoted: string | undefined;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (char === '\\') {
      index++;
      continue;
    }
    if (quoted) {
      if (char === quoted) quoted = undefined;
      continue;
    }
    if (depth === 1 && (index === start || /\s/.test(text[index - 1] ?? ''))) {
      if (char === '<') quoted = '>';
      else if (char === '"' || char === "'") quoted = char;
    }
    if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return index + 1;
  }
  return text.length;
}

type Part = string | { userId: string };

function appendInline(parts: Part[], text: string) {
  // Index matching backtick runs up front so unmatched runs never rescan the text.
  const nextTicks = new Map<number, number>();
  const lastRun = new Map<number, number>();
  for (const run of text.matchAll(/`+/g)) {
    const length = run[0].length;
    const previous = lastRun.get(length);
    if (previous !== undefined) nextTicks.set(previous, run.index);
    lastRun.set(length, run.index);
  }

  // Escapes, code runs, link brackets, mentions, HTML tags, entities and emphasis.
  const tokens =
    /\\([^\w\s])|`+|!?\[|\]|<@([\w-]+)(?:>|$)|<\/?([a-z][a-z0-9-]*)(?=[\s/>])(?:[^<>"']|"[^"<]*"|'[^'<]*')*>|&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);|\*+|_+|~~/gi;
  const labels: number[] = [];
  let offset = 0;
  for (let match = tokens.exec(text); match; match = tokens.exec(text)) {
    const [token, escaped, userId, tag, entity] = match;
    parts.push(text.slice(offset, match.index));

    if (escaped) parts.push(escaped);
    else if (userId) parts.push(token.endsWith('>') ? { userId } : ' ');
    else if (tag) {
      if (/^(?:details|summary|br)$/i.test(tag)) parts.push(' ');
    } else if (entity) parts.push(decodeEntity(entity, token));
    else if (token.startsWith('`')) {
      const close = nextTicks.get(match.index);
      if (close !== undefined) {
        parts.push(text.slice(tokens.lastIndex, close));
        tokens.lastIndex = close + token.length;
      }
    } else if (token.endsWith('[')) {
      labels.push(parts.length);
      parts.push(token);
    } else if (token === ']') {
      const opener = labels.pop();
      if (opener !== undefined && text[tokens.lastIndex] === '(') {
        parts[opener] = '';
        tokens.lastIndex = afterLinkDestination(text, tokens.lastIndex + 1);
      } else {
        parts.push(token);
      }
    }
    offset = tokens.lastIndex;
  }
  parts.push(text.slice(offset));
}

function stripBlockMarkers(line: string) {
  if (/^\s*([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line)) return '';
  if (/^[ \t]*\|(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$/.test(line)) return '';
  return line
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/, (_match, cells: string) =>
      cells.replace(/(?<!\\)\|/g, ' ')
    )
    .replace(/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+/, '')
    .replace(/^[ \t]*(?:#{1,6}|>|[-*+]|\d+\.)[ \t]+/, '');
}

function excerptParts(source: string) {
  const parts: Part[] = [];
  let prose: string[] = [];
  let fence: string | undefined;
  for (const line of source.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker?.[1]?.startsWith(fence) && !marker[2]?.trim())
        fence = undefined;
      else parts.push(line, ' ');
    } else if (marker?.[1]) {
      appendInline(parts, prose.join('\n'));
      parts.push(' ');
      prose = [];
      fence = marker[1];
    } else {
      prose.push(stripBlockMarkers(line));
    }
  }
  appendInline(parts, prose.join('\n'));
  return parts;
}

/** Reads a bounded prefix of the editor's Markdown and resolves its mention tokens. */
export async function canvasExcerpt(
  markdown: string,
  namesFor: (userIds: string[]) => Promise<ReadonlyMap<string, string>>
) {
  // Carry a code point of lookahead to avoid splitting a grapheme at the source cap.
  const source = markdown.slice(0, SOURCE_LIMIT + 2);
  const end = graphemes.segment(source).containing(SOURCE_LIMIT)?.index;
  const parts = excerptParts(source.slice(0, end ?? SOURCE_LIMIT));
  const ids = new Set<string>();
  for (const part of parts) if (typeof part !== 'string') ids.add(part.userId);
  const names = ids.size ? await namesFor([...ids]) : undefined;

  const text = parts
    .map((part) => {
      if (typeof part === 'string') return part;
      const name = names?.get(part.userId)?.trim();
      return name ? `@${name}` : ' ';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= CANVAS_LINK_EXCERPT_MAX) return text;
  const boundary = graphemes.segment(text).containing(CANVAS_LINK_EXCERPT_MAX);
  return text.slice(0, boundary?.index ?? CANVAS_LINK_EXCERPT_MAX).trimEnd();
}
