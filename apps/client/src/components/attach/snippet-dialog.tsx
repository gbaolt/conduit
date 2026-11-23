'use client';

import { FILE_SIZE_MAX, fileTooLargeMessage } from '@conduit/contract';
import { Button } from '@conduit/ui/components/button';
import { Checkbox } from '@conduit/ui/components/checkbox';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@conduit/ui/components/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@conduit/ui/components/dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@conduit/ui/components/field';
import { Input } from '@conduit/ui/components/input';
import { Spinner } from '@conduit/ui/components/spinner';
import { Textarea } from '@conduit/ui/components/textarea';
import { cn } from '@conduit/ui/lib/utils';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import React from 'react';
import { toast } from 'sonner';

import {
  RecipientsField,
  recipientsFieldTitle,
} from '@/components/recipients-field';
import { useRecipients } from '@/hooks/use-recipients';
import { chipsOf, sameTo, type To, toOfRoom } from '@/lib/recipients';
import { useShareFile } from '@/services/messages/hooks';

import {
  languageForName,
  PLAIN_TEXT,
  type SnippetLanguage,
  snippetName,
} from './utils/snippet-name';

const AUTO: SnippetLanguage = { id: 'auto', name: 'Auto detect' };

let shikiLanguages: Promise<SnippetLanguage[]> | undefined;

/** Shiki's languages, the ones `CodeBlockContent` highlights, loaded once with Shiki itself. */
function loadLanguages() {
  shikiLanguages ??= import('shiki').then(({ bundledLanguagesInfo }) =>
    bundledLanguagesInfo
      .map(({ id, name, aliases }) => ({ id, name, aliases }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  return shikiLanguages;
}

function useLanguages(open: boolean) {
  const [languages, setLanguages] = React.useState<SnippetLanguage[]>([]);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    void loadLanguages().then((loaded) => live && setLanguages(loaded));
    return () => {
      live = false;
    };
  }, [open]);
  return languages;
}

/**
 * Line numbers beside the content, scrolled with it. While lines wrap, each number stands as tall as its line,
 * measured from a hidden copy of the text at the textarea's width.
 */
function SnippetContent({
  id,
  value,
  wrap,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  value: string;
  wrap: boolean;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  const gutter = React.useRef<HTMLDivElement>(null);
  const area = React.useRef<HTMLTextAreaElement>(null);
  const copy = React.useRef<HTMLDivElement>(null);
  const lines = value.split('\n');
  const [heights, setHeights] = React.useState<number[]>([]);

  React.useLayoutEffect(() => {
    const textarea = area.current;
    const mirror = copy.current;
    if (!wrap || !textarea || !mirror) return;
    const measure = () => {
      const style = getComputedStyle(textarea);
      mirror.style.width = `${textarea.clientWidth}px`;
      mirror.style.paddingInline = `${style.paddingLeft} ${style.paddingRight}`;
      setHeights(
        Array.from(mirror.children, (row) => (row as HTMLElement).offsetHeight)
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [wrap, value]);

  return (
    <div
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 relative flex h-48 overflow-hidden rounded-lg border focus-within:ring-3 sm:h-64',
        invalid && 'border-destructive ring-destructive/20 ring-3'
      )}
    >
      <div
        ref={gutter}
        aria-hidden
        className="text-muted-foreground bg-muted/50 shrink-0 overflow-hidden py-2 ps-3 pe-2 text-right font-mono text-sm leading-5 tabular-nums select-none"
      >
        {lines.map((_, index) => (
          <div
            key={index}
            style={wrap ? { height: heights[index] } : undefined}
          >
            {index + 1}
          </div>
        ))}
      </div>
      {wrap && (
        <div
          ref={copy}
          aria-hidden
          className="pointer-events-none invisible absolute top-0 left-0 font-mono text-sm leading-5 [overflow-wrap:break-word] whitespace-pre-wrap"
        >
          {lines.map((line, index) => (
            <div key={index}>{line || ' '}</div>
          ))}
        </div>
      )}
      <Textarea
        ref={area}
        id={id}
        value={value}
        wrap={wrap ? 'soft' : 'off'}
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder="Paste or write code or text"
        className={cn(
          '[field-sizing:fixed] h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm leading-5 focus-visible:ring-0 aria-invalid:ring-0 md:text-sm dark:bg-transparent',
          wrap ? 'whitespace-pre-wrap' : 'whitespace-pre'
        )}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (gutter.current) {
            gutter.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
      />
    </div>
  );
}

/**
 * Writes a text or code file in place. Its content type is always plain text, and its name always ends in its
 * language's extension. The file joins the composer like an upload, so the member writes the message there.
 * With `roomId`, Share to starts on that conversation, and picking another one posts the file there instead.
 */
export function SnippetDialog({
  open,
  onOpenChange,
  onCreate,
  roomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (file: File) => void;
  roomId?: string;
}) {
  const router = useRouter();
  const share = useShareFile();
  const { recipients, dms, viewerId } = useRecipients();
  const here = React.useMemo(
    () => (roomId ? toOfRoom(roomId, recipients, dms, viewerId) : null),
    [roomId, recipients, dms, viewerId]
  );
  // Null until the member changes Share to, so it follows `here` while the lists load.
  const [picked, setPicked] = React.useState<To | null>(null);
  const [message, setMessage] = React.useState('');
  const to = picked ?? here;
  const elsewhere =
    here && to && chipsOf(to).length > 0 && !sameTo(to, here) ? to : null;

  const languages = useLanguages(open);
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<SnippetLanguage>(AUTO);
  const [content, setContent] = React.useState('');
  const [wrap, setWrap] = React.useState(false);
  const ids = {
    title: React.useId(),
    message: React.useId(),
    content: React.useId(),
    name: React.useId(),
    size: React.useId(),
  };

  const language =
    type.id === AUTO.id ? languageForName(title, languages) : type;
  const name = snippetName(title, language);
  const size = new Blob([content]).size;
  const tooLarge = size > FILE_SIZE_MAX;

  const reset = () => {
    setTitle('');
    setType(AUTO);
    setContent('');
    setWrap(false);
    setPicked(null);
    setMessage('');
  };

  let submitLabel = 'Create snippet';
  if (elsewhere) submitLabel = 'Share';
  else if (here) submitLabel = 'Add to message';

  const post = (file: File, destination: To) =>
    share.mutate(
      {
        to:
          destination.kind === 'channel'
            ? { roomId: destination.room.id }
            : { userIds: destination.people.map((row) => row.person.userId) },
        file,
        body: message.trim(),
      },
      {
        onSuccess: (room) => {
          onOpenChange(false);
          toast.success(
            `Shared to ${chipsOf(destination).map(recipientsFieldTitle).join(', ')}`,
            {
              action: {
                label: 'Open',
                onClick: () =>
                  router.push(
                    `/${room.kind === 'dm' ? 'dms' : 'channels'}/${room.id}` as Route
                  ),
              },
            }
          );
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => !next && reset()}
    >
      <DialogContent className="sm:max-w-2xl">
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            if (!content || tooLarge || share.isPending) return;
            const file = new File([content], name, { type: 'text/plain' });
            if (elsewhere) return post(file, elsewhere);
            onCreate(file);
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Create a snippet</DialogTitle>
            <DialogDescription>
              {here
                ? 'Share code or text as a file, here or in another conversation.'
                : 'Share code or text as a file. You write the message in the composer.'}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {here && to && (
              <Field>
                <FieldLabel>Share to</FieldLabel>
                <RecipientsField
                  recipients={recipients}
                  to={to}
                  onChange={setPicked}
                  label="Share to"
                />
              </Field>
            )}
            {elsewhere && (
              <Field>
                <FieldLabel htmlFor={ids.message}>
                  Message{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FieldLabel>
                <Input
                  id={ids.message}
                  value={message}
                  autoComplete="off"
                  placeholder="Add a message"
                  onChange={(event) => setMessage(event.target.value)}
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
              <Field>
                <FieldLabel htmlFor={ids.title}>
                  Title{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FieldLabel>
                <Input
                  id={ids.title}
                  value={title}
                  placeholder="snippet.txt"
                  autoComplete="off"
                  aria-describedby={ids.name}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <FieldDescription id={ids.name} className="truncate">
                  Saved as {name}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Combobox
                  autoHighlight
                  items={[AUTO, PLAIN_TEXT, ...languages]}
                  value={type}
                  onValueChange={(next: SnippetLanguage | null) =>
                    setType(next ?? AUTO)
                  }
                  itemToStringLabel={(item: SnippetLanguage) => item.name}
                  isItemEqualToValue={(
                    a: SnippetLanguage,
                    b: SnippetLanguage
                  ) => a.id === b.id}
                >
                  <ComboboxInput
                    aria-label="Type"
                    placeholder="Search languages"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No language by that name.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: SnippetLanguage) => (
                        <ComboboxItem key={item.id} value={item}>
                          {item.name}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
            </div>
            <Field data-invalid={tooLarge || undefined}>
              <FieldLabel htmlFor={ids.content}>Content</FieldLabel>
              <SnippetContent
                id={ids.content}
                value={content}
                wrap={wrap}
                invalid={tooLarge}
                describedBy={tooLarge ? ids.size : undefined}
                onChange={setContent}
              />
              {tooLarge && (
                <FieldError id={ids.size}>
                  {fileTooLargeMessage(size)}
                </FieldError>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter className="flex-row items-center justify-between">
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id={`${ids.content}-wrap`}
                checked={wrap}
                onCheckedChange={(checked) => setWrap(checked === true)}
              />
              <FieldLabel
                htmlFor={`${ids.content}-wrap`}
                className="font-normal"
              >
                Wrap lines
              </FieldLabel>
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!content || tooLarge || share.isPending}
              >
                {share.isPending && <Spinner data-icon="inline-start" />}
                {submitLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
