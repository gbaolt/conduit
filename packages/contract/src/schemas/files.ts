import { z } from 'zod';

import { FILE_KINDS } from '@/lib/file-kind';
import { MESSAGE_FILES_MAX } from '@/lib/file-limits';
import { RoomKindSchema } from '@/schemas/rooms';

/** What a message carries about each attached file. It never changes once the message is sent. */
export const MessageFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  /** Set for images and videos the browser could measure, so a preview holds its space. */
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type MessageFile = z.infer<typeof MessageFileSchema>;

export const FILE_NAME_MAX = 255;

export const FileUploadInputSchema = z.object({
  roomId: z.string(),
  name: z.string().trim().min(1).max(FILE_NAME_MAX),
  contentType: z.string().max(255),
  size: z.number().int().positive(),
});
export type FileUploadInput = z.infer<typeof FileUploadInputSchema>;

export const FileUploadSchema = z.object({
  fileId: z.string(),
  /** Presigned PUT URL. Send the file with the same `Content-Type` and size. */
  uploadUrl: z.string(),
});
export type FileUpload = z.infer<typeof FileUploadSchema>;

const dimension = z.number().int().positive().max(100_000);

export const CompleteFileInputSchema = z.object({
  fileId: z.string(),
  width: dimension.optional(),
  height: dimension.optional(),
});

export const FileIdInputSchema = z.object({ fileId: z.string() });

export const FileUrlsInputSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(MESSAGE_FILES_MAX),
});

/** Presigned links that last 10 minutes. A file the viewer cannot read is left out, as if it did not exist. */
export const FileUrlSchema = z.object({
  id: z.string(),
  /** Shows the file in place. Null for a kind the browser should not open inline. */
  viewUrl: z.string().nullable(),
  /** Downloads the file under its original name. */
  downloadUrl: z.string(),
});
export type FileUrl = z.infer<typeof FileUrlSchema>;

export const FileKindSchema = z.enum(FILE_KINDS);

export const FILES_PAGE_DEFAULT = 50;
export const FILES_PAGE_MAX = 100;
export const FILE_SEARCH_MAX = 100;

export const ListFilesInputSchema = z.object({
  roomId: z.string().optional(),
  uploaderId: z.string().optional(),
  kind: FileKindSchema.optional(),
  /** Part of the file name, ignoring case. */
  name: z.string().trim().max(FILE_SEARCH_MAX).optional(),
  /** The oldest file already loaded. The page ends just before it. */
  before: z.string().optional(),
  limit: z.number().int().min(1).max(FILES_PAGE_MAX).optional(),
});
export type ListFilesInput = z.infer<typeof ListFilesInputSchema>;

/** A sent file on the Files page, with where it was shared and by whom. */
export const ListedFileSchema = MessageFileSchema.extend({
  messageId: z.string(),
  /** The thread the message replies in, so a link can open it there. */
  parentId: z.string().nullable(),
  room: z.object({
    id: z.string(),
    /** Empty for a DM. */
    name: z.string(),
    kind: RoomKindSchema,
  }),
  uploader: z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  }),
  createdAt: z.coerce.date(),
});
export type ListedFile = z.infer<typeof ListedFileSchema>;

export const ListFilesOutputSchema = z.object({
  /** Newest first. */
  files: z.array(ListedFileSchema),
  hasMore: z.boolean(),
});
export type ListFilesOutput = z.infer<typeof ListFilesOutputSchema>;
