import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@conduit/ui/components/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@conduit/ui/components/tooltip';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { CLEAR_EDITOR_COMMAND } from 'lexical';
import { Trash2Icon } from 'lucide-react';

export function ClearEditorActionPlugin() {
  const [editor] = useLexicalComposerContext();

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button size={'sm'} variant={'ghost'} className="p-2">
                  <Trash2Icon className="size-4" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Clear Editor</TooltipContent>
      </Tooltip>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear Editor</DialogTitle>
          <DialogDescription>
            Are you sure you want to clear the editor?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />

          <DialogClose
            render={
              <Button
                variant="destructive"
                onClick={() => {
                  editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
                }}
              >
                Clear
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
