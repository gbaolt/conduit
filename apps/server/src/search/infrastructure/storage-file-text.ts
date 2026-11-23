import { fileKind } from '@conduit/contract';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { getDocumentProxy } from 'unpdf';

import type { FileText } from '@/search/domain/file-text.port';
import { FILE_TEXT_CHARS_MAX } from '@/search/domain/search-doc';
import { ObjectStorage } from '@/storage/domain/object-storage';

/** A bigger file is found by its name only, so one drain never holds a huge file in memory. */
export const FILE_TEXT_BYTES_MAX = 20 * 1024 * 1024;

const readsAsText = (contentType: string) =>
  /^text\//.test(contentType) ||
  /^application\/(json|xml|csv)\b/.test(contentType);

/**
 * Reads pages until the text fills a file's chunks. Parsing blocks the event loop the API's other requests share,
 * and a 19.5 MB PDF read whole blocked it for 9.2 s, against 0.36 s when stopped at the cap.
 */
async function pdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  let text = '';
  for (let n = 1; n <= pdf.numPages && text.length < FILE_TEXT_CHARS_MAX; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
    }
    // A page break is the nearest thing a PDF has to a paragraph, so chunks prefer to end there.
    text += '\n\n';
    page.cleanup();
  }
  return text;
}

/** Reads a PDF with unpdf and a text file as UTF-8. Every other kind has no text. */
@Injectable()
export class StorageFileText implements FileText {
  private readonly logger = new Logger(StorageFileText.name);

  constructor(@Inject(ObjectStorage) private readonly storage: ObjectStorage) {}

  async extract(file: { key: string; contentType: string; size: number }) {
    const pdf = fileKind(file.contentType) === 'pdf';
    if (!pdf && !readsAsText(file.contentType)) return '';
    if (file.size > FILE_TEXT_BYTES_MAX) return '';

    const bytes = await this.storage.read(file.key);
    if (!pdf) return new TextDecoder().decode(bytes);
    try {
      return await pdfText(bytes);
    } catch (error) {
      // A broken or encrypted PDF fails the same way on every retry, so it is found by its name only.
      this.logger.warn(`Unreadable PDF ${file.key}: ${String(error)}`);
      return '';
    }
  }
}
