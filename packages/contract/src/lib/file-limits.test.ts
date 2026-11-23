import { describe, expect, it } from 'vitest';

import {
  FILE_SIZE_MAX,
  fileTooLargeMessage,
  formatFileSize,
  storageFullMessage,
  WORKSPACE_STORAGE_MAX,
} from './file-limits';

describe('file limits', () => {
  it('caps a file at 50 MB and a workspace at 10 GB', () => {
    expect(formatFileSize(FILE_SIZE_MAX)).toBe('50 MB');
    expect(formatFileSize(WORKSPACE_STORAGE_MAX)).toBe('10 GB');
  });

  it.each([
    [0, '0 B'],
    [900, '900 B'],
    [340 * 1024, '340 KB'],
    [1.5 * 1024 * 1024, '1.5 MB'],
    [72 * 1024 * 1024, '72 MB'],
  ])('formats %d bytes as %s', (bytes, text) => {
    expect(formatFileSize(bytes)).toBe(text);
  });

  it('says how big a refused file is and how full the workspace is', () => {
    expect(fileTooLargeMessage(72 * 1024 * 1024)).toBe(
      'Files can be up to 50 MB. This one is 72 MB.'
    );
    expect(storageFullMessage(WORKSPACE_STORAGE_MAX)).toBe(
      'This workspace has used 10 GB of 10 GB. Delete files or ask an admin to free space.'
    );
  });
});
