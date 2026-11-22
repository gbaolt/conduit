import { describe, expect, it } from 'vitest';

import {
  ASK_DOCUMENT_SIZE_MAX,
  ASK_IMAGE_SIZE_MAX,
  askAttachmentKind,
  askAttachmentProblem,
} from './ask-attachments';

describe('ask attachments', () => {
  it.each([
    ['image/png', 'image'],
    ['image/JPEG', 'image'],
    ['application/pdf', 'document'],
    ['text/markdown; charset=utf-8', 'document'],
    ['application/json', 'document'],
    ['image/svg+xml', null],
    ['video/mp4', null],
    ['application/zip', null],
  ])('reads %s as %s', (contentType, kind) => {
    expect(askAttachmentKind(contentType)).toBe(kind);
  });

  it('caps an image at 5 MB and a document at 20 MB', () => {
    expect(askAttachmentProblem('image/png', ASK_IMAGE_SIZE_MAX)).toBeNull();
    expect(askAttachmentProblem('image/png', ASK_IMAGE_SIZE_MAX + 1)).toMatch(
      /^Images can be up to 5 MB here/
    );
    expect(
      askAttachmentProblem('application/pdf', ASK_DOCUMENT_SIZE_MAX)
    ).toBeNull();
    expect(askAttachmentProblem('video/mp4', 10)).toBe(
      'Ask Conduit reads images, PDFs and text files.'
    );
  });
});
