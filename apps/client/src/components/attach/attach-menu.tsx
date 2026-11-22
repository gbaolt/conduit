'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { IconFileCode, IconFiles, IconUpload } from '@tabler/icons-react';
import {
  type ComponentProps,
  type ReactElement,
  useRef,
  useState,
} from 'react';

import { FilesDialog } from './files-dialog';
import { SnippetDialog } from './snippet-dialog';

/** What the Files dialog offers, and where its picks go. Without it, Files stays disabled. */
type AttachFiles = Omit<
  ComponentProps<typeof FilesDialog>,
  'open' | 'onOpenChange' | 'onUpload'
>;

/**
 * The paperclip's menu: pick a file shared in the workspace, write a snippet, or upload from the device. Every
 * route ends in `onFiles`, as a drop or a paste does. `full` disables the routes that add a file, with its reason
 * in the tooltip.
 */
export function AttachMenu({
  trigger,
  onFiles,
  accept,
  full,
  files,
}: {
  /** The paperclip button, styled for its composer. */
  trigger: ReactElement;
  onFiles: (files: File[]) => void;
  /** What the device picker offers, as the input's `accept`. */
  accept?: string;
  /** Why no more files can join, such as "Up to 4 files". */
  full?: string;
  files?: AttachFiles;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={trigger}
                aria-label="Attach"
                // Keeps the selection in the editor while the menu opens.
                onMouseDown={(event) => event.preventDefault()}
              />
            }
          />
          <TooltipContent>{full ?? 'Attach'}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem
            disabled={!files || Boolean(full)}
            onClick={() => setFilesOpen(true)}
          >
            <IconFiles />
            Files
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(full)}
            onClick={() => setSnippetOpen(true)}
          >
            <IconFileCode />
            Snippet
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(full)}
            onClick={() => picker.current?.click()}
          >
            <IconUpload />
            Upload from your device
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        accept={accept}
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          // Cleared so picking the same file again still fires a change.
          event.currentTarget.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
      {files && (
        <FilesDialog
          {...files}
          open={filesOpen}
          onOpenChange={setFilesOpen}
          onUpload={() => {
            setFilesOpen(false);
            picker.current?.click();
          }}
        />
      )}
      <SnippetDialog
        open={snippetOpen}
        onOpenChange={setSnippetOpen}
        onCreate={(file) => onFiles([file])}
      />
    </>
  );
}
