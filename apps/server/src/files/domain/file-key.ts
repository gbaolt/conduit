const SAFE_NAME_MAX = 100;

/** A file name with only letters, digits, dots and dashes, kept to its last 100 characters. */
export const safeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(-SAFE_NAME_MAX) || 'file';

/**
 * Where a file is stored: `files/<organizationId>/<fileId>/<safe name>`. The bucket serves only `workspaces/`
 * publicly, so nothing under `files/` is readable without a presigned URL.
 */
export function fileKey(organizationId: string, fileId: string, name: string) {
  return `files/${organizationId}/${fileId}/${safeFileName(name)}`;
}
