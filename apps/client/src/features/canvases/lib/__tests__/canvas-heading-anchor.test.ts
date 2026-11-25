import { describe, expect, it } from 'vitest';

import {
  assignHeadingAnchors,
  headingAnchorFromHash,
  headingUrlOf,
  slugifyHeading,
} from '../canvas-heading-anchor';

describe('canvas heading anchors', () => {
  it('slugifies heading text and falls back to section when empty', () => {
    expect(slugifyHeading('Launch Plan & Milestones!')).toBe(
      'launch-plan-milestones'
    );
    expect(slugifyHeading('   ')).toBe('section');
    expect(slugifyHeading('???')).toBe('section');
    expect(slugifyHeading('Kế hoạch Q4')).toBe('kế-hoạch-q4');
  });

  it('deduplicates repeated headings without colliding with numbered ones', () => {
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

  it('builds a heading URL preserving search params and parses the hash back', () => {
    const url = headingUrlOf(
      'http://localhost:3000/channels/c1?tab=cv1#old',
      'action-items'
    );
    expect(url).toBe('http://localhost:3000/channels/c1?tab=cv1#action-items');
    expect(headingAnchorFromHash('#action-items')).toBe('action-items');
    expect(headingAnchorFromHash('')).toBeNull();
    expect(headingAnchorFromHash('#%E0%A4%A')).toBeNull();
  });
});
