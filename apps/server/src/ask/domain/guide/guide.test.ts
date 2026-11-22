import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ASK_SYSTEM_PROMPT } from '@/ask/domain/ask-prompt';

import { GUIDE, NOT_IN_GUIDE } from './guide';

const articlesDir = new URL('./articles/', import.meta.url);
const prd = readFileSync(
  new URL('../../../../../../PRD.md', import.meta.url),
  'utf8'
);

/** The rows of the PRD's sub-feature tables: `| M3.5 | Cap each file at 50 MB | Shipped | |`. */
const rows = [
  ...prd.matchAll(/^\|\s*((?:F|M\d+)\.\d+)\s*\|[^|]*\|\s*([^|]+?)\s*\|/gm),
].map(([, id, status]) => ({ id: id!, status: status! }));
const shipped = new Set(
  rows.filter((row) => row.status === 'Shipped').map((row) => row.id)
);

describe('the Conduit guide', () => {
  it('reads the PRD', () => {
    expect(shipped.size).toBeGreaterThan(40);
  });

  it('gives every article a unique kebab-case slug the prompt lists', () => {
    const slugs = GUIDE.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(ASK_SYSTEM_PROMPT).toContain(`- ${slug}: `);
    }
  });

  it('states no size as a typed literal', () => {
    for (const name of readdirSync(articlesDir)) {
      const source = readFileSync(new URL(name, articlesDir), 'utf8');
      expect(source, name).not.toMatch(/\b\d+(?:\.\d+)?\s?(?:B|KB|MB|GB|TB)\b/);
    }
  });

  it('covers only rows the PRD marks Shipped', () => {
    for (const article of GUIDE) {
      for (const id of article.covers) {
        expect(shipped, `${article.slug} covers ${id}`).toContain(id);
      }
    }
    for (const id of NOT_IN_GUIDE) expect(shipped).toContain(id);
  });

  it('covers every Shipped row, or lists it as not in the guide', () => {
    const covered = new Set([
      ...GUIDE.flatMap((article) => article.covers),
      ...NOT_IN_GUIDE,
    ]);
    expect([...shipped].filter((id) => !covered.has(id))).toEqual([]);
  });
});
