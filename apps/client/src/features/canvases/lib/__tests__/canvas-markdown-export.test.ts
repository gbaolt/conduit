import { describe, expect, it } from 'vitest';

import { markdownFilenameOf } from '../canvas-markdown-export';

describe('canvas Markdown export filename', () => {
  it('appends .md and sanitizes illegal filename characters', () => {
    expect(markdownFilenameOf('Launch Plan')).toBe('Launch Plan.md');
    expect(markdownFilenameOf('Q4: Launch / Notes?')).toBe(
      'Q4- Launch - Notes.md'
    );
  });

  it('falls back to Untitled and avoids doubling .md', () => {
    expect(markdownFilenameOf('   ')).toBe('Untitled.md');
    expect(markdownFilenameOf('...')).toBe('Untitled.md');
    expect(markdownFilenameOf('README.md')).toBe('README.md');
  });
});
