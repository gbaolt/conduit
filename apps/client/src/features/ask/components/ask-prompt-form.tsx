'use client';

import { ASK_QUESTION_MAX } from '@conduit/contract';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@conduit/ui/components/input-group';
import { IconArrowUp, IconPlayerStopFilled } from '@tabler/icons-react';
import { useState } from 'react';

import { useAsk } from '../context/ask-provider';

/** The question field. Enter asks, Shift+Enter adds a line, and Stop replaces Ask while an answer streams. */
export function AskPromptForm() {
  const { draft, turn, send, stop } = useAsk();
  const [question, setQuestion] = useState(draft);
  const [lastDraft, setLastDraft] = useState(draft);
  if (draft !== lastDraft) {
    setLastDraft(draft);
    setQuestion(draft);
  }
  const streaming = turn?.status === 'streaming';

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || streaming) return;
    send(text);
    setQuestion('');
  };

  return (
    <form onSubmit={submit} className="shrink-0 px-3 pb-3">
      <InputGroup>
        <InputGroupTextarea
          autoFocus
          aria-label="Question"
          placeholder="What did we decide about pricing?"
          maxLength={ASK_QUESTION_MAX}
          rows={2}
          className="max-h-40 min-h-0 px-3 pt-2.5"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
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
              aria-label="Ask"
              disabled={!question.trim()}
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
