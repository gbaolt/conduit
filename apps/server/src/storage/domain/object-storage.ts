import type { IconUpload } from '@conduit/contract';

/** Public file storage. The keys are chosen by the caller. */
export abstract class ObjectStorage {
  /** Throws `STORAGE_UNAVAILABLE` when storage is not configured. */
  abstract presignUpload(input: {
    key: string;
    contentType: string;
    size: number;
  }): Promise<IconUpload>;

  /** Where `key` is served from. Throws `STORAGE_UNAVAILABLE` when storage is not configured. */
  abstract publicUrl(key: string): string;
}
