import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

import { DomainError } from '@/shared/domain/domain-error';
import type { ObjectStorage } from '@/storage/domain/object-storage';

const UPLOAD_URL_TTL_SECONDS = 300;
export const DOWNLOAD_URL_TTL_SECONDS = 600;
/** DeleteObjects takes at most 1,000 keys per call. */
const DELETE_BATCH = 1000;

/** `attachment; filename="..."` with a UTF-8 fallback, so a non-ASCII name survives. */
export function contentDisposition(filename: string, inline: boolean) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Reads its settings per call, so the server starts without them and only storage calls fail. */
@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  private client?: S3Client;

  async presignUpload(input: {
    key: string;
    contentType: string;
    size: number;
  }) {
    const { bucket } = this.config();
    const uploadUrl = await getSignedUrl(
      this.s3(),
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.size,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS }
    );

    return { uploadUrl, publicUrl: this.publicUrl(input.key) };
  }

  publicUrl(key: string) {
    return `${this.config().publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  }

  async presignDownload(
    key: string,
    options: { filename: string; contentType: string; inline: boolean }
  ) {
    return getSignedUrl(
      this.s3(),
      new GetObjectCommand({
        Bucket: this.config().bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(
          options.filename,
          options.inline
        ),
        ResponseContentType: options.contentType,
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
    );
  }

  async head(key: string) {
    try {
      const head = await this.s3().send(
        new HeadObjectCommand({ Bucket: this.config().bucket, Key: key })
      );
      return { size: head.ContentLength ?? 0 };
    } catch (error) {
      if (
        error instanceof NotFound ||
        (error instanceof S3ServiceException &&
          error.$metadata.httpStatusCode === 404)
      ) {
        return null;
      }
      throw error;
    }
  }

  async read(key: string) {
    const object = await this.s3().send(
      new GetObjectCommand({ Bucket: this.config().bucket, Key: key })
    );
    if (!object.Body) throw new Error(`Nothing is stored at ${key}.`);
    return object.Body.transformToByteArray();
  }

  async readRange(key: string, bytes: number) {
    const object = await this.s3().send(
      new GetObjectCommand({
        Bucket: this.config().bucket,
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      })
    );
    if (!object.Body) throw new Error(`Nothing is stored at ${key}.`);
    return object.Body.transformToByteArray();
  }

  async copy(from: string, to: string) {
    const { bucket } = this.config();
    const source = from.split('/').map(encodeURIComponent).join('/');
    await this.s3().send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${source}`,
        Key: to,
      })
    );
  }

  async delete(keys: string[]) {
    const { bucket } = this.config();
    for (let start = 0; start < keys.length; start += DELETE_BATCH) {
      await this.s3().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keys
              .slice(start, start + DELETE_BATCH)
              .map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    }
  }

  private s3() {
    const { region, endpoint, accessKeyId, secretAccessKey } = this.config();
    this.client ??= new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // A browser PUT sends no checksum, so a presigned URL must not require one (R2 rejects it).
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    return this.client;
  }

  private config() {
    const env = process.env;
    const bucket = env.S3_BUCKET;
    const region = env.S3_REGION;
    // Unset for AWS; an S3-compatible store such as Cloudflare R2 needs its API URL here.
    const endpoint = env.S3_ENDPOINT || undefined;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const publicBaseUrl = env.S3_PUBLIC_BASE_URL;

    if (
      !bucket ||
      !region ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicBaseUrl
    ) {
      throw new DomainError(
        'STORAGE_UNAVAILABLE',
        'Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_BASE_URL to enable uploads.'
      );
    }
    return {
      bucket,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
    };
  }
}
