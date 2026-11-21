import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';

import {
  CompleteFileInputSchema,
  FileIdInputSchema,
  FileUploadInputSchema,
  FileUploadSchema,
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
} as const;

const {
  NOT_FOUND,
  FORBIDDEN,
  CHANNEL_ARCHIVED,
  FILE_TOO_LARGE,
  STORAGE_FULL,
  UPLOAD_MISSING,
  STORAGE_UNAVAILABLE,
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
