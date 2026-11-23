'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@conduit/ui/components/dropdown-menu';
import { Input } from '@conduit/ui/components/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import {
  IconDeviceDesktopUp,
  IconFileCode,
  IconFiles,
} from '@tabler/icons-react';
import {
  type ComponentProps,
  type ReactElement,
  useRef,
  useState,
} from 'react';

import { FilesDialog } from './files-dialog';
import { SnippetDialog } from './snippet-dialog';

type AttachFiles = Omit<
  ComponentProps<typeof FilesDialog>,
  'open' | 'onOpenChange' | 'onUpload'
>;

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
                onMouseDown={(event) => event.preventDefault()}
              />
            }
          />
          <TooltipContent>{full ?? 'Attach'}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="top" align="start" className="w-fit">
          <DropdownMenuItem
            disabled={!files || Boolean(full)}
            onClick={() => setFilesOpen(true)}
          >
            <IconFiles data-slot="icon" />
            Files
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(full)}
            onClick={() => setSnippetOpen(true)}
          >
            <IconFileCode data-slot="icon" />
            Snippet
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(full)}
            onClick={() => picker.current?.click()}
          >
            <IconDeviceDesktopUp data-slot="icon" />
            Upload from your device
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        ref={picker}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        accept={accept}
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
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
        roomId={files?.targetRoomId}
      />
    </>
  );
}
