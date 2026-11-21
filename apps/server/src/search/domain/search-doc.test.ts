import { describe, expect, it } from 'vitest';

import {
  FILE_CHUNK_CHARS,
  FILE_CHUNKS_MAX,
  fileDocIds,
  fileDocs,
  type FileSource,
  messageDoc,
  type MessageSource,
} from './search-doc';

const message = (overrides: Partial<MessageSource> = {}): MessageSource => ({
  id: 'm1',
  roomId: 'c1',
  authorId: 'u1',
  parentId: null,
  body: 'Ship it',
  hasFile: false,
  createdAt: new Date(1000),
  mentionNames: {},
  ...overrides,
});

const file: FileSource = {
  id: 'f1',
  roomId: 'c1',
  uploaderId: 'u1',
  messageId: 'm1',
  parentId: 't1',
  name: 'Q3 pricing.pdf',
  contentType: 'application/pdf',
  createdAt: new Date(2000),
};

describe('messageDoc', () => {
  it('names each mention and drops the Markdown, so a search for a person finds the message', () => {
    expect(
      messageDoc(
        message({
          body: '**Hey** <@u2>, see [the doc](https://x.test)',
          mentionNames: { u2: 'Linh Pham' },
        })
      )
    ).toEqual({
      id: 'message:m1',
      data: 'Hey @Linh Pham, see the doc',
      metadata: {
        kind: 'message',
        roomId: 'c1',
        authorId: 'u1',
        createdAt: 1000,
        hasFile: 0,
      },
    });
  });

  it('keeps a 4,000-character body whole, with its thread and its files flagged', () => {
    const body = 'a'.repeat(4000);
    const doc = messageDoc(message({ body, parentId: 't1', hasFile: true }));

    expect(doc!.data).toHaveLength(4000);
    expect(doc!.metadata).toMatchObject({ parentId: 't1', hasFile: 1 });
  });

  it('gives a message with only files no document of its own', () => {
    expect(messageDoc(message({ body: '', hasFile: true }))).toBeNull();
  });
});

describe('fileDocs', () => {
  it('makes chunk 0 the name and slices the text after it', () => {
    const docs = fileDocs(file, 'x'.repeat(FILE_CHUNK_CHARS + 10));

    expect(docs.map((doc) => [doc.id, doc.data.length])).toEqual([
      ['file:f1:0', 'Q3 pricing.pdf'.length],
      ['file:f1:1', FILE_CHUNK_CHARS],
      ['file:f1:2', 10],
    ]);
    expect(docs[0]!.metadata).toEqual({
      kind: 'file',
      roomId: 'c1',
      authorId: 'u1',
      createdAt: 2000,
      hasFile: 1,
      fileKind: 'pdf',
      messageId: 'm1',
      parentId: 't1',
    });
  });

  it('gives a file with no text one document, its name', () => {
    expect(fileDocs(file, '  \n ')).toHaveLength(1);
  });

  it(`stops at ${FILE_CHUNKS_MAX} documents however long the text is`, () => {
    expect(
      fileDocs(file, 'y'.repeat(FILE_CHUNK_CHARS * FILE_CHUNKS_MAX * 2))
    ).toHaveLength(FILE_CHUNKS_MAX);
  });

  it('names the chunks a shorter text leaves behind', () => {
    expect(fileDocIds('f1', 2, 5)).toEqual([
      'file:f1:2',
      'file:f1:3',
      'file:f1:4',
    ]);
    expect(fileDocIds('f1', 5, 2)).toEqual([]);
  });
});
