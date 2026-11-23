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
    ['text/plain', 'text'],
    ['text/markdown; charset=utf-8', 'text'],
    ['text/csv', 'text'],
    ['application/json', 'text'],
    ['application/xml', 'text'],
    ['application/zip', 'other'],
    ['application/octet-stream', 'other'],
    ['', 'other'],
  ])('reads %s as %s', (contentType, kind) => {
    expect(fileKind(contentType)).toBe(kind);
  });

  it('lists the content types of a kind', () => {
    expect(contentTypesOf('pdf')).toEqual(['application/pdf']);
    expect(contentTypesOf('image')).toContain('image/webp');
    expect(contentTypesOf('image')).not.toContain('video/mp4');
    expect(contentTypesOf('text')).toContain('application/json');
  });
});
