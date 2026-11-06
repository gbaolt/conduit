import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

import { DomainError } from '@/shared/domain/domain-error';
import type { ObjectStorage } from '@/storage/domain/object-storage';

const UPLOAD_URL_TTL_SECONDS = 300;

/** Reads its settings per call, so the server starts without them and only uploads fail. */
@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  private client?: S3Client;

  async presignUpload(input: {
    key: string;
    contentType: string;
    size: number;
  }) {
    const { bucket, region, accessKeyId, secretAccessKey } = this.config();
    this.client ??= new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    const uploadUrl = await getSignedUrl(
      this.client,
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

  private config() {
    const env = process.env;
    const bucket = env.S3_BUCKET;
    const region = env.S3_REGION;
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
        'Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_BASE_URL to enable image uploads.'
      );
    }
    return { bucket, region, accessKeyId, secretAccessKey, publicBaseUrl };
  }
}
