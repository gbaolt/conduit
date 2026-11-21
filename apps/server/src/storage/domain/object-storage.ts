import type { IconUpload } from '@conduit/contract';

/** File storage. The keys are chosen by the caller. Every method throws `STORAGE_UNAVAILABLE` when storage is not configured. */
export abstract class ObjectStorage {
  abstract presignUpload(input: {
    key: string;
    contentType: string;
    size: number;
  }): Promise<IconUpload>;

  /** Where `key` is served from when its prefix is public. */
  abstract publicUrl(key: string): string;

  /**
   * A short-lived GET for a private object. `inline` lets the browser show it in place; otherwise it downloads
   * as `filename`.
   */
  abstract presignDownload(
    key: string,
    options: { filename: string; contentType: string; inline: boolean }
  ): Promise<string>;

  /** The stored object's size, or null when nothing is stored at `key`. */
  abstract head(key: string): Promise<{ size: number } | null>;

  /** Removes each object. A key with nothing stored is not an error. */
  abstract delete(keys: string[]): Promise<void>;
}
