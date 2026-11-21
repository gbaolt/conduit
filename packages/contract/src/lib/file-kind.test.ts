import { describe, expect, it } from 'vitest';

import { contentTypesOf, fileKind } from './file-kind';

describe('fileKind', () => {
  it.each([
    ['image/png', 'image'],
    ['image/JPEG', 'image'],
    ['video/mp4', 'video'],
    ['application/pdf', 'pdf'],
    ['application/pdf; charset=binary', 'pdf'],
    ['image/svg+xml', 'other'],
    ['text/plain', 'other'],
    ['', 'other'],
  ])('reads %s as %s', (contentType, kind) => {
    expect(fileKind(contentType)).toBe(kind);
  });

  it('lists the content types of a kind', () => {
    expect(contentTypesOf('pdf')).toEqual(['application/pdf']);
    expect(contentTypesOf('image')).toContain('image/webp');
    expect(contentTypesOf('image')).not.toContain('video/mp4');
  });
});
