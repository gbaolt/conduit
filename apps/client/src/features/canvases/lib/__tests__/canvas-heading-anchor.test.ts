import { describe, expect, it } from 'vitest';

import {
  assignHeadingAnchors,
  createHeadingAnchorId,
  extractHeadingAnchorId,
  findHeadingByAnchor,
  headingAnchorFromHash,
  headingAnchorOf,
  headingUrlOf,
  isHeadingAnchorId,
  slugifyHeading,
} from '../canvas-heading-anchor';

describe('canvas heading anchors', () => {
  it('slugifies heading text, normalizes NFC, keeps combining marks, and maps underscores to hyphens', () => {
    expect(slugifyHeading('Launch Plan & Milestones!')).toBe(
      'launch-plan-milestones'
    );
    expect(slugifyHeading('foo_bar__baz')).toBe('foo-bar-baz');
    expect(slugifyHeading('   ')).toBe('section');
    expect(slugifyHeading('???')).toBe('section');
    expect(slugifyHeading('Kế hoạch Q4')).toBe('kế-hoạch-q4');
    // NFD decomposed input normalizes to the same NFC slug.
    expect(slugifyHeading('Kế hoạch Q4'.normalize('NFD'))).toBe('kế-hoạch-q4');
  });

  it('deduplicates legacy headings without an anchorId', () => {
    const result = assignHeadingAnchors([
      { text: 'Overview' },
      { text: 'Overview 2' },
      { text: 'Overview' },
      { text: 'Overview' },
    ]);
    expect(result.map((h) => h.anchor)).toEqual([
      'overview',
      'overview-2',
      'overview-3',
      'overview-4',
    ]);
  });

  it('keeps a copied link pointing at the original heading after inserting a same-named heading above or renaming it', () => {
    const original = assignHeadingAnchors([
      { key: 'h1', text: 'Plan', anchorId: 'a1b2c3d4' },
    ]);
    const copiedAnchor = original[0]!.anchor;
    expect(copiedAnchor).toBe('plan--a1b2c3d4');
    expect(extractHeadingAnchorId(copiedAnchor)).toBe('a1b2c3d4');

    // Insert a same-named heading above and rename the original.
    const updated = assignHeadingAnchors([
      { key: 'h2', text: 'Plan', anchorId: 'e5f60718' },
      { key: 'h1', text: 'Q4 Launch Plan', anchorId: 'a1b2c3d4' },
    ]);
    expect(findHeadingByAnchor(updated, copiedAnchor)?.key).toBe('h1');
    // A bare ID fragment also resolves to the heading.
    expect(findHeadingByAnchor(updated, 'a1b2c3d4')?.key).toBe('h1');
  });

  it('resolves legacy links when headings have no anchorId and after Copy link assigns an ID', () => {
    const legacy = assignHeadingAnchors([
      { key: 'h1', text: 'Plan', anchorId: null },
      { key: 'h2', text: 'Plan', anchorId: null },
    ]);
    expect(findHeadingByAnchor(legacy, 'plan')?.key).toBe('h1');
    expect(findHeadingByAnchor(legacy, 'plan-2')?.key).toBe('h2');

    // Assigning an ID to the first heading keeps both legacy slugs resolving to their original targets.
    const afterCopyLink = assignHeadingAnchors([
      { key: 'h1', text: 'Plan', anchorId: 'a1b2c3d4' },
      { key: 'h2', text: 'Plan', anchorId: null },
    ]);
    expect(afterCopyLink[0]!.anchor).toBe('plan--a1b2c3d4');
    expect(afterCopyLink[1]!.anchor).toBe('plan-2');
    expect(findHeadingByAnchor(afterCopyLink, 'plan')?.key).toBe('h1');
    expect(findHeadingByAnchor(afterCopyLink, 'plan-2')?.key).toBe('h2');
    expect(findHeadingByAnchor(afterCopyLink, 'plan--a1b2c3d4')?.key).toBe(
      'h1'
    );
  });

  it('resolves duplicate IDs to the first heading in document order', () => {
    const duplicated = assignHeadingAnchors([
      { key: 'h1', text: 'Alpha', anchorId: 'a1b2c3d4' },
      { key: 'h2', text: 'Beta', anchorId: 'a1b2c3d4' },
    ]);
    expect(findHeadingByAnchor(duplicated, 'alpha--a1b2c3d4')?.key).toBe('h1');
    expect(findHeadingByAnchor(duplicated, 'beta--a1b2c3d4')?.key).toBe('h1');
    expect(findHeadingByAnchor(duplicated, 'a1b2c3d4')?.key).toBe('h1');
  });

  it('generates valid unique 8-character IDs', () => {
    const used = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const id = createHeadingAnchorId(used);
      expect(isHeadingAnchorId(id)).toBe(true);
      expect(used.has(id)).toBe(false);
      used.add(id);
    }
    expect(headingAnchorOf('Plan', 'a1b2c3d4')).toBe('plan--a1b2c3d4');
  });

  it('builds a heading URL preserving search params and parses the hash back', () => {
    const url = headingUrlOf(
      'http://localhost:3000/channels/c1?tab=cv1#old',
      'action-items--a1b2c3d4'
    );
    expect(url).toBe(
      'http://localhost:3000/channels/c1?tab=cv1#action-items--a1b2c3d4'
    );
    expect(headingAnchorFromHash('#action-items--a1b2c3d4')).toBe(
      'action-items--a1b2c3d4'
    );
    expect(headingAnchorFromHash('')).toBeNull();
    expect(headingAnchorFromHash('#%E0%A4%A')).toBeNull();
  });
});
