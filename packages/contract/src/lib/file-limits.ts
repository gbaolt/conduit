const MB = 1024 * 1024;

/** The largest file one upload may be. */
export const FILE_SIZE_MAX = 50 * MB;

/** What a workspace may store in all. */
export const WORKSPACE_STORAGE_MAX = 10 * 1024 * MB;

/** How many files one message may carry. */
export const MESSAGE_FILES_MAX = 10;

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** `72 MB`, `1.5 GB`, `340 KB`. Whole numbers from 10 up, one decimal below. */
export function formatFileSize(bytes: number) {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded =
    unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[unit]}`;
}

export function fileTooLargeMessage(size: number) {
  return `Files can be up to ${formatFileSize(FILE_SIZE_MAX)}. This one is ${formatFileSize(size)}.`;
}

export function storageFullMessage(used: number) {
  return `This workspace has used ${formatFileSize(used)} of ${formatFileSize(WORKSPACE_STORAGE_MAX)}. Delete files or ask an admin to free space.`;
}
