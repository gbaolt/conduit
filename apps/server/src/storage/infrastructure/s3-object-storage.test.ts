import { CopyObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { contentDisposition, S3ObjectStorage } from './s3-object-storage';

describe('S3ObjectStorage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('copies inside the bucket, naming the source by bucket and encoded key', async () => {
    vi.stubEnv('S3_BUCKET', 'bkt');
    vi.stubEnv('S3_REGION', 'us-east-1');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'AKIATEST');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('S3_PUBLIC_BASE_URL', 'https://cdn.test');
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);

    await new S3ObjectStorage().copy(
      'files/o/a/Q3 plan.pdf',
      'files/o/b/Q3 plan.pdf'
    );

    const [command] = send.mock.calls[0]!;
    expect(command).toBeInstanceOf(CopyObjectCommand);
    expect((command as CopyObjectCommand).input).toEqual({
      Bucket: 'bkt',
      CopySource: 'bkt/files/o/a/Q3%20plan.pdf',
      Key: 'files/o/b/Q3 plan.pdf',
    });
  });

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

  it('signs against a custom endpoint such as Cloudflare R2', async () => {
    vi.stubEnv('S3_BUCKET', 'conduit');
    vi.stubEnv('S3_REGION', 'auto');
    vi.stubEnv('S3_ENDPOINT', 'https://acct.r2.cloudflarestorage.com');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('S3_PUBLIC_BASE_URL', 'https://files.test');

    const { uploadUrl } = await new S3ObjectStorage().presignUpload({
      key: 'workspaces/o/icons/a.png',
      contentType: 'image/png',
      size: 10,
    });

    expect(new URL(uploadUrl).host).toContain('acct.r2.cloudflarestorage.com');
    expect(uploadUrl).not.toContain('x-amz-sdk-checksum-algorithm');
  });

  it('signs a download that names the file and expires in 10 minutes', async () => {
    vi.stubEnv('S3_BUCKET', 'bkt');
    vi.stubEnv('S3_REGION', 'us-east-1');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'AKIATEST');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('S3_PUBLIC_BASE_URL', 'https://cdn.test');

    const url = new URL(
      await new S3ObjectStorage().presignDownload('files/o/f/q3.pdf', {
        filename: 'Q3 pricing.pdf',
        contentType: 'application/pdf',
        inline: false,
      })
    );

    expect(url.pathname).toContain('files/o/f/q3.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(url.searchParams.get('response-content-disposition')).toBe(
      contentDisposition('Q3 pricing.pdf', false)
    );
  });
});

describe('contentDisposition', () => {
  it('keeps a non-ASCII name in the UTF-8 form and strips quotes from the plain one', () => {
    expect(contentDisposition('báo "cáo".pdf', true)).toBe(
      `inline; filename="b_o _c_o_.pdf"; filename*=UTF-8''b%C3%A1o%20%22c%C3%A1o%22.pdf`
    );
  });
});
