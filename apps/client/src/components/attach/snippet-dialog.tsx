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
import { Textarea } from '@conduit/ui/components/textarea';
import { cn } from '@conduit/ui/lib/utils';
import { useEffect, useId, useRef, useState } from 'react';

import {
  languageForName,
  PLAIN_TEXT,
  type SnippetLanguage,
  snippetName,
} from './snippet-name';

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
  const [languages, setLanguages] = useState<SnippetLanguage[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadLanguages().then((loaded) => live && setLanguages(loaded));
    return () => {
      live = false;
    };
  }, [open]);
  return languages;
}

/** Line numbers beside the content, scrolled with it. Hidden while lines wrap, since a wrapped line would skew them. */
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
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;

  return (
    <div
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex h-48 overflow-hidden rounded-lg border focus-within:ring-3 sm:h-64',
        invalid && 'border-destructive ring-destructive/20 ring-3'
      )}
    >
      {!wrap && (
        <div
          ref={gutter}
          aria-hidden
          className="text-muted-foreground bg-muted/50 shrink-0 overflow-hidden py-2 ps-3 pe-2 text-right font-mono text-sm leading-5 tabular-nums select-none"
        >
          {Array.from({ length: lines }, (_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
      )}
      <Textarea
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
 * Writes a text or code file in place. The file joins the composer like an upload, so the member writes the
 * message there. Its content type is always plain text, and its name always ends in its language's extension.
 */
export function SnippetDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (file: File) => void;
}) {
  const languages = useLanguages(open);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SnippetLanguage>(AUTO);
  const [content, setContent] = useState('');
  const [wrap, setWrap] = useState(false);
  const ids = {
    title: useId(),
    content: useId(),
    name: useId(),
    size: useId(),
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
  };

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
            if (!content || tooLarge) return;
            onCreate(new File([content], name, { type: 'text/plain' }));
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Create a snippet</DialogTitle>
            <DialogDescription>
              Share code or text as a file. You write the message in the
              composer.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
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
              <Button type="submit" disabled={!content || tooLarge}>
                Create snippet
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
