import { describe, expect, it } from 'vitest';

import { FILE_TEXT_CHARS_MAX } from '@/search/domain/search-doc';
import type { ObjectStorage } from '@/storage/domain/object-storage';

import { StorageFileText } from './storage-file-text';

/** A PDF of `pages` pages, each holding `line` 40 times. */
function pdf(pages: number, line: string) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const kids: number[] = [];
  for (let page = 0; page < pages; page++) {
    const body = `BT /F1 9 Tf 40 800 Td 11 TL${` (${line}) '`.repeat(40)} ET`;
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length} 0 R >>`
    );
    kids.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(' ')}] /Count ${pages} >>`;
  let out = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = out.length;
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

const reading = (bytes: Uint8Array) =>
  new StorageFileText({ read: async () => bytes } as unknown as ObjectStorage);

const file = (size: number) => ({
  key: 'files/o/f/a.pdf',
  contentType: 'application/pdf',
  size,
});

describe('StorageFileText', () => {
  it('reads a PDF’s text', async () => {
    const bytes = pdf(2, 'Q3 pricing tiers');
    expect(await reading(bytes).extract(file(bytes.length))).toContain(
      'Q3 pricing tiers'
    );
  });

  it('stops reading a long PDF once its text fills the chunks', async () => {
    const line =
      'Quarterly revenue grew while churn fell across every region. ';
    const bytes = pdf(400, line);
    const text = await reading(bytes).extract(file(bytes.length));

    expect(text.length).toBeGreaterThanOrEqual(FILE_TEXT_CHARS_MAX);
    expect(text.length).toBeLessThan(
      FILE_TEXT_CHARS_MAX + 40 * (line.length + 1) + 1
    );
  });

  it('finds a broken PDF by its name only', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 not really');
    expect(await reading(bytes).extract(file(bytes.length))).toBe('');
  });
});
