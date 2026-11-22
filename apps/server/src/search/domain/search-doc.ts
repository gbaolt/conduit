import { type FileKind, fileKind, plainText } from '@conduit/contract';

/** Each chunk of a file's text, in characters. */
export const FILE_CHUNK_CHARS = 2000;
/** A file's chunks, its name included, so one huge PDF cannot take over a workspace's index. */
export const FILE_CHUNKS_MAX = 200;
/** The most text a file's chunks can hold. Reading past it is wasted work. */
export const FILE_TEXT_CHARS_MAX = FILE_CHUNK_CHARS * (FILE_CHUNKS_MAX - 1);

/** The only fields a search filter reads. Upstash filters on numbers, so `createdAt` is epoch ms and `hasFile` 0 or 1. */
export type SearchDocMetadata = {
  kind: 'message' | 'file';
  roomId: string;
  authorId: string;
  createdAt: number;
  hasFile: 0 | 1;
  parentId?: string;
  /** For a file: its kind and the message that carries it. */
  fileKind?: FileKind;
  messageId?: string;
};

/** One document in a workspace's namespace. Upstash embeds and keyword-indexes `data`. */
export type SearchDoc = {
  id: string;
  data: string;
  metadata: SearchDocMetadata;
};

export const messageDocId = (messageId: string) => `message:${messageId}`;
export const fileDocId = (fileId: string, chunk: number) =>
  `file:${fileId}:${chunk}`;

/** The ids of a file's chunks from `from` up to, not including, `to`. */
export const fileDocIds = (fileId: string, from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from) }, (_, index) =>
    fileDocId(fileId, from + index)
  );

/** A live message, as the drain reads it. */
export type MessageSource = {
  id: string;
  roomId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  hasFile: boolean;
  createdAt: Date;
  /** Names for the `<@userId>` tokens in `body`. */
  mentionNames: Record<string, string>;
};

/** A message's one document, or null when it has no text to find, as a files-only message has. */
export function messageDoc(message: MessageSource): SearchDoc | null {
  const data = plainText(message.body, message.mentionNames);
  if (!data) return null;
  return {
    id: messageDocId(message.id),
    data,
    metadata: {
      kind: 'message',
      roomId: message.roomId,
      authorId: message.authorId,
      createdAt: message.createdAt.getTime(),
      hasFile: message.hasFile ? 1 : 0,
      ...(message.parentId && { parentId: message.parentId }),
    },
  };
}

/** A sent file, as the drain reads it. */
export type FileSource = {
  id: string;
  roomId: string;
  uploaderId: string;
  messageId: string;
  parentId: string | null;
  name: string;
  contentType: string;
  createdAt: Date;
};

/** Chunk 0 is the file's name, so every file can be found by name. Each later chunk is a slice of its text. */
export function fileDocs(file: FileSource, text: string): SearchDoc[] {
  const metadata: SearchDocMetadata = {
    kind: 'file',
    roomId: file.roomId,
    authorId: file.uploaderId,
    createdAt: file.createdAt.getTime(),
    hasFile: 1,
    fileKind: fileKind(file.contentType),
    messageId: file.messageId,
    ...(file.parentId && { parentId: file.parentId }),
  };
  const flat = text.replace(/\s+/g, ' ').trim();
  const chunks = [file.name];
  for (
    let start = 0;
    start < flat.length && chunks.length < FILE_CHUNKS_MAX;
    start += FILE_CHUNK_CHARS
  ) {
    chunks.push(flat.slice(start, start + FILE_CHUNK_CHARS));
  }
  return chunks.map((data, chunk) => ({
    id: fileDocId(file.id, chunk),
    data,
    metadata,
  }));
}
