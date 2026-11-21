import { z } from 'zod';

import { MESSAGE_FILES_MAX } from '@/lib/file-limits';

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
