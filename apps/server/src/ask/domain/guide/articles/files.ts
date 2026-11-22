import {
  FILE_SIZE_MAX,
  formatFileSize,
  MESSAGE_FILES_MAX,
  WORKSPACE_STORAGE_MAX,
} from '@conduit/contract';

import type { GuideArticle } from '../guide';

export const files: GuideArticle = {
  slug: 'files',
  title: 'Files and uploads',
  covers: ['M3.1', 'M3.2', 'M3.3', 'M3.4', 'M3.5', 'M3.6'],
  body: `- **Upload** by dragging files onto a conversation, pasting them into the message box, or choosing the paperclip. A message carries up to ${MESSAGE_FILES_MAX} files.
- **Previews.** Images, videos, and PDFs show inside the message. Other files show as a card you can download.
- **The Files page** lists every file you can open, and filters by channel, by person, and by type.

**Limits.**

- One file can be up to ${formatFileSize(FILE_SIZE_MAX)}.
- A workspace stores up to ${formatFileSize(WORKSPACE_STORAGE_MAX)} of files in all. Once it is full, uploads stop with a message that says so. Deleting files frees space, so ask an admin if the workspace is full.

A file shared in a private channel or a DM is open only to the people in it.`,
};
