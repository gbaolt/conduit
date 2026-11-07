import { afterEach, describe, expect, it, vi } from 'vitest';

import { S3ObjectStorage } from './s3-object-storage';

describe('S3ObjectStorage', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('fails with STORAGE_UNAVAILABLE when the S3 settings are missing', async () => {
    vi.stubEnv('S3_BUCKET', '');

    await expect(
      new S3ObjectStorage().presignUpload({
        key: 'k.png',
        contentType: 'image/png',
        size: 1,
      })
    ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });

  it('signs an upload URL for the key when configured', async () => {
    vi.stubEnv('S3_BUCKET', 'bkt');
    vi.stubEnv('S3_REGION', 'us-east-1');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'AKIATEST');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('S3_PUBLIC_BASE_URL', 'https://cdn.test/');

    const { uploadUrl, publicUrl } = await new S3ObjectStorage().presignUpload({
      key: 'workspaces/o/icons/a.png',
      contentType: 'image/png',
      size: 10,
    });

    expect(uploadUrl).toContain('bkt');
    expect(uploadUrl).toContain('workspaces/o/icons/a.png');
    expect(uploadUrl).toContain('X-Amz-Signature=');
    expect(publicUrl).toBe('https://cdn.test/workspaces/o/icons/a.png');
  });
});
