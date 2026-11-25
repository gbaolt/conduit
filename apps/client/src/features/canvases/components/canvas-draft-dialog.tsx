'use client';

import type { CanvasDraft } from '@conduit/contract';
import { AILoader } from '@conduit/ui/components/ai-loader';
import { Button } from '@conduit/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import { DropdownMenuItem } from '@conduit/ui/components/dropdown-menu';
import { Field, FieldLabel } from '@conduit/ui/components/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import { IconFileText } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, use, useId, useState } from 'react';

import { StatusButton } from '@/components/async/status-button';
import { Markdown } from '@/components/markdown';
import { useSplit } from '@/hooks/use-split';
import {
  type CanvasDraftState,
  useCanvasDraftRun,
} from '@/services/canvases/draft';
import { useCreateCanvas } from '@/services/canvases/hooks';
import { threadRootQuery } from '@/services/messages/queries';
import { roomQuery } from '@/services/rooms/queries';

import { canvasHref } from '../lib/canvas-href';

/** Where a created draft goes: a new tab in the channel or DM, or a canvas of one's own. */
type Destination = 'room' | 'standalone';

const STANDALONE = {
  value: 'standalone',
  label: 'Standalone private canvas',
} as const satisfies { value: Destination; label: string };

const CanvasDraftContext = createContext<((threadId: string) => void) | null>(
  null
);

/**
 * Holds the draft dialog for the threads inside it. The thread menu that starts a draft closes before the draft
 * finishes, so the dialog lives here instead of in the menu.
 */
export function CanvasDraftProvider({ children }: { children: ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const run = useCanvasDraftRun();

  const open = (id: string) => {
    setThreadId(id);
    void run.draft(id);
  };

  return (
    <CanvasDraftContext value={open}>
      {children}
      {threadId && (
        <CanvasDraftDialog
          key={threadId}
          threadId={threadId}
          state={run.state}
          onRetry={() => void run.draft(threadId)}
          onClose={run.dismiss}
        />
      )}
    </CanvasDraftContext>
  );
}

/** The thread menu's "Turn into canvas". It drafts the open thread. */
export function CanvasDraftMenuItem() {
  const open = use(CanvasDraftContext);
  const [{ thread }] = useSplit();
  if (!open || !thread) return null;

  return (
    <DropdownMenuItem onClick={() => open(thread)}>
      <IconFileText data-slot="icon" />
      Turn into canvas
    </DropdownMenuItem>
  );
}

/** The places this thread's draft may go. An archived channel takes no new canvas. */
function useDestinations(threadId: string) {
  const root = useQuery(threadRootQuery(threadId));
  const roomId = root.data?.roomId;
  const room = useQuery({ ...roomQuery(roomId ?? ''), enabled: !!roomId });

  const options: { value: Destination; label: string }[] = [STANDALONE];
  if (room.data && !room.data.archivedAt) {
    options.unshift({
      value: 'room',
      label: room.data.kind === 'dm' ? 'Canvas in this DM' : 'Channel canvas',
    });
  }
  return { roomId, options, loading: root.isPending || room.isPending };
}

function CanvasDraftDialogDestination({
  options,
  loading,
  value,
  onChange,
}: {
  options: readonly { value: Destination; label: string }[];
  loading: boolean;
  value: Destination;
  onChange: (destination: Destination) => void;
}) {
  const id = useId();

  return (
    <Field orientation="horizontal" className="w-full sm:mr-auto sm:w-auto">
      <FieldLabel htmlFor={id} className="shrink-0">
        Save as
      </FieldLabel>
      <Select
        items={options}
        value={value}
        disabled={loading || options.length === 1}
        onValueChange={(next) => next && onChange(next)}
      >
        <SelectTrigger id={id} className="min-w-0 flex-1 sm:w-56 sm:flex-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function heading(state: CanvasDraftState) {
  if (state.status === 'error') return "Couldn't draft a canvas";
  if (state.status === 'done') return state.draft.title;
  if (state.status === 'streaming' && state.title) return state.title;
  return 'Turn into canvas';
}

function description(state: CanvasDraftState) {
  if (state.status !== 'error') {
    return 'Only you can see this draft until you create the canvas.';
  }
  return state.code === 'AI_UNAVAILABLE' || state.code === null
    ? 'AI is unavailable right now.'
    : state.message;
}

/**
 * A thread drafted as a canvas, streamed into a dialog that only its requester sees. Closing it stops the draft
 * and saves nothing; **Create canvas** saves it where the member picks and opens it.
 */
function CanvasDraftDialog({
  threadId,
  state,
  onRetry,
  onClose,
}: {
  threadId: string;
  state: CanvasDraftState;
  onRetry: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const create = useCreateCanvas();
  const { roomId, options, loading } = useDestinations(threadId);
  const [picked, setPicked] = useState<Destination | null>(null);
  const [creating, setCreating] = useState(false);
  // Until the member picks, or when their pick stops being offered, the first place offered.
  const destination =
    options.find((option) => option.value === picked)?.value ??
    options[0]?.value ??
    'standalone';
  const streaming = state.status === 'streaming';
  let markdown = '';
  if (state.status === 'done') markdown = state.draft.markdown;
  if (state.status === 'streaming') markdown = state.markdown;

  const close = () => {
    setCreating(false);
    create.reset();
    onClose();
  };

  const createCanvas = async (draft: CanvasDraft) => {
    setCreating(true);
    try {
      // Loaded on click, so the editor stays out of the conversation's bundle.
      const { canvasSnapshotOf } = await import('../lib/canvas-extension');
      const content = canvasSnapshotOf(draft.markdown);
      create.mutate(
        {
          title: draft.title,
          ...(destination !== 'standalone' && {
            roomId,
          }),
          initialMarkdown: draft.markdown,
          ...content,
          sourceThreadId: draft.sourceThreadId,
          sourceMessageIds: draft.sourceMessageIds,
          versionTrigger: 'ai_draft',
        },
        {
          onSuccess: (canvas) => {
            close();
            router.push(canvasHref(canvas));
          },
          onSettled: () => setCreating(false),
        }
      );
    } catch {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={state.status !== 'idle'}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Centered, scaling from its middle; reduced motion keeps only the fade. */}
      <DialogContent
        className="motion-reduce:data-closed:zoom-out-100 motion-reduce:data-open:zoom-in-100 origin-center duration-200 ease-out sm:max-w-2xl"
        aria-busy={streaming}
      >
        <DialogHeader>
          <DialogTitle className="text-lg leading-tight text-balance">
            {heading(state)}
          </DialogTitle>
          <DialogDescription>{description(state)}</DialogDescription>
        </DialogHeader>
        {state.status !== 'error' && (
          // A fixed height, so the centered dialog does not move while the draft streams in.
          <div className="-mx-4 h-[min(60svh,32rem)] overflow-y-auto px-4">
            {markdown ? (
              <Markdown className="typeset">{markdown}</Markdown>
            ) : (
              <div
                role="status"
                className="text-muted-foreground flex items-center text-sm"
              >
                <span aria-hidden className="flex w-5 shrink-0">
                  <AILoader dotSize={2} />
                </span>
                <span className="shimmer motion-reduce:shimmer-none">
                  Drafting canvas from thread...
                </span>
              </div>
            )}
          </div>
        )}
        {create.isError && (
          <p role="alert" className="text-destructive text-sm">
            Couldn&apos;t create the canvas. {create.error.message}
          </p>
        )}
        <DialogFooter>
          {state.status !== 'error' && (
            <CanvasDraftDialogDestination
              options={options}
              loading={loading}
              value={destination}
              onChange={setPicked}
            />
          )}
          <DialogClose render={<Button variant="outline" />}>
            {streaming ? 'Stop' : 'Close'}
          </DialogClose>
          {state.status === 'error' ? (
            state.code !== 'AI_DISABLED' &&
            state.code !== 'NOTHING_TO_DRAFT' && (
              <Button onClick={onRetry}>Retry</Button>
            )
          ) : (
            <StatusButton
              disabled={state.status !== 'done'}
              status={creating || create.isPending ? 'loading' : 'idle'}
              onClick={() => {
                if (state.status === 'done') void createCanvas(state.draft);
              }}
            >
              Create canvas
            </StatusButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
