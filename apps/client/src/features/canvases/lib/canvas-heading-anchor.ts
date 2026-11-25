/** Turns heading text into a URL-safe slug, falling back to `section` for empty or symbol-only headings. */
export function slugifyHeading(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** Assigns a unique, stable anchor slug to each heading in document order. */
export function assignHeadingAnchors<T extends { text: string }>(
  headings: readonly T[]
): Array<T & { anchor: string }> {
  const used = new Set<string>();
  return headings.map((heading) => {
    const base = slugifyHeading(heading.text);
    let anchor = base;
    let suffix = 2;
    while (used.has(anchor)) {
      anchor = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(anchor);
    return { ...heading, anchor };
  });
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
