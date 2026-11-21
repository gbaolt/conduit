import { fileKind } from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';
import { extractText } from 'unpdf';

import type { FileText } from '@/search/domain/file-text.port';
import { ObjectStorage } from '@/storage/domain/object-storage';

/** A bigger file is found by its name only, so one drain never holds a huge file in memory. */
export const FILE_TEXT_BYTES_MAX = 20 * 1024 * 1024;

const readsAsText = (contentType: string) =>
  /^text\//.test(contentType) ||
  /^application\/(json|xml|csv)\b/.test(contentType);

/** Reads a PDF with unpdf and a text file as UTF-8. Every other kind has no text. */
@Injectable()
export class StorageFileText implements FileText {
  constructor(@Inject(ObjectStorage) private readonly storage: ObjectStorage) {}

  async extract(file: { key: string; contentType: string; size: number }) {
    const pdf = fileKind(file.contentType) === 'pdf';
    if (!pdf && !readsAsText(file.contentType)) return '';
    if (file.size > FILE_TEXT_BYTES_MAX) return '';

    const bytes = await this.storage.read(file.key);
    if (!pdf) return new TextDecoder().decode(bytes);
    const { text } = await extractText(bytes, { mergePages: true });
    return text;
  }
}
