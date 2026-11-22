'use client';

import { ASK_ATTACHMENTS_MAX, ASK_QUESTION_MAX } from '@conduit/contract';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@conduit/ui/components/input-group';
import { cn } from '@conduit/ui/lib/utils';
import {
  IconArrowUp,
  IconPaperclip,
  IconPlayerStopFilled,
} from '@tabler/icons-react';
import { useState } from 'react';

import { AttachMenu } from '@/components/attach/attach-menu';
import { ComposerAttachments } from '@/components/composer/composer-attachments';
import { useFileDrop } from '@/features/messages/components/conversation/conversation-drop';
import {
  ASK_ATTACHMENT_ACCEPT,
  ASK_FILE_KINDS,
  askUploads,
} from '@/services/ask/attachments';
import { useFileUploads } from '@/services/files/upload';

import { useAsk } from '../context/ask-provider';

/**
 * The question field. Enter asks, Shift+Enter adds a line, and Stop replaces Ask while an answer streams. Files
 * join from the attach menu, a drop, or a paste, and Ask waits until they finish uploading.
 */
export function AskPromptForm() {
  const { draft, turn, send, stop } = useAsk();
  const [question, setQuestion] = useState(draft);
  const [lastDraft, setLastDraft] = useState(draft);
  if (draft !== lastDraft) {
    setLastDraft(draft);
    setQuestion(draft);
  }
  const uploads = useFileUploads(askUploads);
  const drop = useFileDrop(uploads.add);
  const streaming = turn?.status === 'streaming';
  const blocked = uploads.uploading > 0;
  const full = uploads.ready.length + uploads.uploading >= ASK_ATTACHMENTS_MAX;

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || streaming || blocked) return;
    send(text, uploads.ready);
    uploads.clear();
    setQuestion('');
  };

  return (
    <form onSubmit={submit} className="shrink-0 px-4 pb-4" {...drop.handlers}>
      <InputGroup
        className={cn(
          'transition-[border-color,box-shadow] duration-150',
          drop.dragging && 'border-primary/60 ring-primary/20 ring-3'
        )}
      >
        {uploads.uploads.length > 0 && (
          <InputGroupAddon align="block-start" className="px-0 pt-2">
            <ComposerAttachments
              uploads={uploads.uploads}
              onRemove={uploads.remove}
            />
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          autoFocus
          aria-label="Question"
          placeholder={
            drop.dragging
              ? 'Drop to attach'
              : 'What did we decide about pricing?'
          }
          maxLength={ASK_QUESTION_MAX}
          rows={2}
          className="max-h-40 min-h-0 px-3 pt-2.5"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onPaste={(event) => {
            const files = [...event.clipboardData.files];
            // Copied text that also carries an image pastes as text.
            if (files.length === 0 || event.clipboardData.getData('text')) {
              return;
            }
            event.preventDefault();
            uploads.add(files);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <InputGroupAddon align="block-end">
          <AttachMenu
            onFiles={uploads.add}
            accept={ASK_ATTACHMENT_ACCEPT}
            files={{
              kinds: ASK_FILE_KINDS,
              roomKind: 'channel',
              max:
                ASK_ATTACHMENTS_MAX -
                uploads.uploads.filter((upload) => upload.status !== 'failed')
                  .length,
              onInsert: uploads.attach,
            }}
            full={full ? `Up to ${ASK_ATTACHMENTS_MAX} files` : undefined}
            trigger={
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground rounded-full"
              >
                <IconPaperclip />
              </InputGroupButton>
            }
          />
          {streaming ? (
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Stop"
              className="ml-auto rounded-full"
              onClick={stop}
            >
              <IconPlayerStopFilled />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              aria-label={
                blocked ? 'Ask, once the files finish uploading' : 'Ask'
              }
              disabled={!question.trim() || blocked}
              className="ml-auto rounded-full"
            >
              <IconArrowUp />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
