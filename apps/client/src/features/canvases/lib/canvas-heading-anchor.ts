import type { HeadingNode } from '@lexical/rich-text';
import { $getState, $setState, createState } from 'lexical';

const HEADING_ANCHOR_ID_PATTERN = /^[a-z0-9]{8}$/;
const EMBEDDED_ID_PATTERN = /--([a-z0-9]{8})$/;

export function isHeadingAnchorId(value: unknown): value is string {
  return typeof value === 'string' && HEADING_ANCHOR_ID_PATTERN.test(value);
}

/** Persisted in Lexical NodeState on `HeadingNode` so it survives JSON save/reload and Yjs sync. */
export const headingAnchorIdState = createState('anchorId', {
  parse: (value) => (isHeadingAnchorId(value) ? value : null),
});

export function $getHeadingAnchorId(node: HeadingNode): string | null {
  return $getState(node, headingAnchorIdState);
}

export function $setHeadingAnchorId(
  node: HeadingNode,
  anchorId: string | null
): HeadingNode {
  return $setState(node, headingAnchorIdState, anchorId);
}

/** Generates a short unique ID for a heading anchor, avoiding any IDs already in `used`. */
export function createHeadingAnchorId(used?: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const raw =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
        : Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    if (!used?.has(raw)) return raw;
  }
  return Date.now().toString(36).slice(-8).padStart(8, '0');
}

/** Turns heading text into a URL-safe slug, falling back to `section` for empty or symbol-only headings. */
export function slugifyHeading(text: string): string {
  const slug = text
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** Builds a readable, ID-keyed anchor fragment (`<slug>--<id>`) that keeps resolving after renames. */
export function headingAnchorOf(text: string, anchorId: string): string {
  return `${slugifyHeading(text)}--${anchorId}`;
}

/** Extracts the stable heading ID from a `<slug>--<id>` or bare `<id>` anchor, or null for legacy slugs. */
export function extractHeadingAnchorId(anchor: string): string | null {
  if (HEADING_ANCHOR_ID_PATTERN.test(anchor)) return anchor;
  const match = EMBEDDED_ID_PATTERN.exec(anchor);
  return match?.[1] ?? null;
}

/**
 * Assigns a unique anchor and a deduplicated legacy slug to each heading in document order. Headings with a
 * persisted `anchorId` get a stable `<slug>--<id>` fragment while keeping their legacy slug alias so old
 * `#slug` links continue to resolve after an ID is assigned.
 */
export function assignHeadingAnchors<
  T extends { text: string; anchorId?: string | null },
>(headings: readonly T[]): Array<T & { anchor: string; legacyAnchor: string }> {
  const usedLegacy = new Set<string>();
  return headings.map((heading) => {
    const base = slugifyHeading(heading.text);
    let legacyAnchor = base;
    let suffix = 2;
    while (usedLegacy.has(legacyAnchor)) {
      legacyAnchor = `${base}-${suffix}`;
      suffix += 1;
    }
    usedLegacy.add(legacyAnchor);
    const anchor =
      heading.anchorId && isHeadingAnchorId(heading.anchorId)
        ? headingAnchorOf(heading.text, heading.anchorId)
        : legacyAnchor;
    return { ...heading, anchor, legacyAnchor };
  });
}

/** Resolves a decoded URL hash against the document's headings, matching by persisted ID before legacy slug. */
export function findHeadingByAnchor<
  T extends {
    anchor: string;
    anchorId?: string | null;
    legacyAnchor?: string;
  },
>(headings: readonly T[], target: string): T | undefined {
  const id = extractHeadingAnchorId(target);
  if (id) {
    // Duplicate IDs resolve to the first heading in document order.
    const byId = headings.find((heading) => heading.anchorId === id);
    if (byId) return byId;
  }
  return headings.find(
    (heading) => heading.anchor === target || heading.legacyAnchor === target
  );
}

/** Builds a link to a heading on the current canvas URL, preserving any query parameters such as `?tab=`. */
export function headingUrlOf(currentHref: string, anchor: string): string {
  const url = new URL(currentHref);
  url.hash = encodeURIComponent(anchor);
  return url.toString();
}

/** Extracts the decoded heading anchor from a URL hash, or null when the hash is empty or malformed. */
export function headingAnchorFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
