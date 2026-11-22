import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  CompleteFileInputSchema,
  FileAttachInputSchema,
  FileCountsSchema,
  FileFiltersSchema,
  FileIdInputSchema,
  FileTextSchema,
  FileUploadInputSchema,
  FileUploadSchema,
  FileUrlSchema,
  FileUrlsInputSchema,
  ListFilesInputSchema,
  ListFilesOutputSchema,
  MessageFileSchema,
} from '@/schemas/files';

export const fileErrors = {
  NOT_FOUND: { status: 404, message: 'File not found.' },
  FORBIDDEN: {
    status: 403,
    message: 'You do not have permission to share files here.',
  },
  CHANNEL_ARCHIVED: { status: 409, message: 'This channel is archived.' },
  FILE_TOO_LARGE: { status: 413, message: 'Files can be up to 50 MB.' },
  STORAGE_FULL: {
    status: 409,
    message: 'This workspace is out of file storage.',
  },
  UPLOAD_MISSING: {
    status: 409,
    message: 'The upload did not finish. Try again.',
  },
  STORAGE_UNAVAILABLE: {
    status: 503,
    message: 'File uploads are not set up for this deployment.',
  },
  NOT_TEXT: { status: 415, message: 'This file is not text.' },
  FILE_NOT_SHAREABLE: {
    status: 403,
    message: 'Files from private channels and DMs stay where they were shared.',
  },
} as const;

const {
  NOT_FOUND,
  FORBIDDEN,
  CHANNEL_ARCHIVED,
  FILE_TOO_LARGE,
  STORAGE_FULL,
  UPLOAD_MISSING,
  STORAGE_UNAVAILABLE,
  NOT_TEXT,
  FILE_NOT_SHAREABLE,
} = fileErrors;

export const fileUploadUrlContract = oc
  .meta(openapi({ method: 'POST', path: '/files' }))
  .errors({
    NOT_FOUND,
    FORBIDDEN,
    CHANNEL_ARCHIVED,
    FILE_TOO_LARGE,
    STORAGE_FULL,
    STORAGE_UNAVAILABLE,
  })
  .input(FileUploadInputSchema)
  .output(FileUploadSchema);

/** Confirms the upload reached storage at the size it promised. Calling it again changes nothing. */
export const completeFileContract = oc
  .meta(openapi({ method: 'POST', path: '/files/{fileId}/complete' }))
  .errors({ NOT_FOUND, UPLOAD_MISSING, STORAGE_UNAVAILABLE })
  .input(CompleteFileInputSchema)
  .output(MessageFileSchema);

/** Drops a file that no message carries yet. */
export const cancelFileContract = oc
  .meta(openapi({ method: 'DELETE', path: '/files/{fileId}' }))
  .errors({ NOT_FOUND })
  .input(FileIdInputSchema)
  .output(z.void());

export const fileUrlsContract = oc
  .meta(openapi({ method: 'POST', path: '/files/urls' }))
  .errors({ STORAGE_UNAVAILABLE })
  .input(FileUrlsInputSchema)
  .output(z.array(FileUrlSchema));

/** The start of a text file the caller can read, for its preview in a message. */
export const fileTextContract = oc
  .meta(openapi({ method: 'GET', path: '/files/{fileId}/text' }))
  .errors({ NOT_FOUND, NOT_TEXT, STORAGE_UNAVAILABLE })
  .input(FileIdInputSchema)
  .output(FileTextSchema);

/** Sent files in rooms the caller can read, newest first. */
export const listFilesContract = oc
  .meta(openapi({ method: 'GET', path: '/files' }))
  .input(ListFilesInputSchema)
  .output(ListFilesOutputSchema);

/** How many files of each kind `files.list` would show for the same filters. */
export const fileCountsContract = oc
  .meta(openapi({ method: 'GET', path: '/files/counts' }))
  .input(FileFiltersSchema)
  .output(FileCountsSchema);

/**
 * Copies a sent file into `roomId`, ready for the caller's next message there. Only a public channel's file may
 * leave its room. The copy counts toward the workspace's storage.
 */
export const attachFileContract = oc
  .meta(openapi({ method: 'POST', path: '/files/{fileId}/attach' }))
  .errors({
    NOT_FOUND,
    FORBIDDEN,
    CHANNEL_ARCHIVED,
    FILE_NOT_SHAREABLE,
    STORAGE_FULL,
    STORAGE_UNAVAILABLE,
  })
  .input(FileAttachInputSchema)
  .output(MessageFileSchema);
