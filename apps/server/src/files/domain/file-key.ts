const SAFE_NAME_MAX = 100;

/**
 * Where a file is stored: `files/<organizationId>/<fileId>/<safe name>`. The bucket serves only `workspaces/`
 * publicly, so nothing under `files/` is readable without a presigned URL.
 */
export function fileKey(organizationId: string, fileId: string, name: string) {
  const safe =
    name
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|-+$/g, '')
      .slice(-SAFE_NAME_MAX) || 'file';
  return `files/${organizationId}/${fileId}/${safe}`;
}
