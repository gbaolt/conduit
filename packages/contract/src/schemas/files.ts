import { z } from 'zod';

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
