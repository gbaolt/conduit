import { type FileKind, fileKind, plainText } from '@conduit/contract';

/** Each chunk of a file's text, in characters. */
export const FILE_CHUNK_CHARS = 2000;
/** How much of the chunk before each later chunk repeats, so a sentence cut at a chunk's edge is still found whole. */
export const FILE_CHUNK_OVERLAP = 300;
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
  const chunks = [file.name, ...textChunks(text)];
  return chunks.map((data, chunk) => ({
    id: fileDocId(file.id, chunk),
    data,
    metadata,
  }));
}

/** The longest piece a chunk takes whole. Longer ones split at words, so a chunk with its overlap never passes the cap. */
const PIECE_CHARS = FILE_CHUNK_CHARS - FILE_CHUNK_OVERLAP - 1;

/** Paragraphs that fit, else their sentences, else their words, else slices of a word. */
function* pieces(text: string) {
  for (const paragraph of text.split(/\n\s*\n/)) {
    const flat = paragraph.replace(/\s+/g, ' ').trim();
    if (flat.length <= PIECE_CHARS) {
      if (flat) yield flat;
      continue;
    }
    for (const sentence of flat.split(/(?<=[.!?])\s+/)) {
      if (sentence.length <= PIECE_CHARS) {
        yield sentence;
        continue;
      }
      for (const word of sentence.split(' ')) {
        for (let start = 0; start < word.length; start += PIECE_CHARS) {
          yield word.slice(start, start + PIECE_CHARS);
        }
      }
    }
  }
}

/** The last `FILE_CHUNK_OVERLAP` characters of a chunk, starting at a word when there is one. */
function overlap(chunk: string) {
  const tail = chunk.slice(-FILE_CHUNK_OVERLAP);
  const midWord =
    chunk.length > tail.length && chunk.at(-tail.length - 1) !== ' ';
  const space = tail.indexOf(' ');
  return midWord && space >= 0 ? tail.slice(space + 1) : tail;
}

/** Packs the text's pieces into chunks, each after the first starting with the end of the one before. */
function textChunks(text: string) {
  const chunks: string[] = [];
  let chunk = '';
  for (const piece of pieces(text)) {
    if (chunk && chunk.length + 1 + piece.length > FILE_CHUNK_CHARS) {
      chunks.push(chunk);
      if (chunks.length === FILE_CHUNKS_MAX - 1) return chunks;
      chunk = overlap(chunk);
    }
    chunk = chunk ? `${chunk} ${piece}` : piece;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
