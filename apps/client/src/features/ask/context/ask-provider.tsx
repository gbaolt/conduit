'use client';

import type { Answer, MessageFile } from '@conduit/contract';
import dynamic from 'next/dynamic';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { type AskTurn, useAskTurn } from '@/services/ask/hooks';
import { useAiSettings } from '@/services/workspaces/hooks';

const AskPanel = dynamic(
  () => import('../components/ask-panel').then((mod) => mod.AskPanel),
  { ssr: false }
);

type AskValue = {
  /** False when the workspace turned AI off, so every entry point hides. */
  available: boolean;
  open: boolean;
  /** The chat the panel shows, or null for a new one. It is set once the new chat's first answer is stored. */
  chatId: string | null;
  /** What the question field holds when the panel opens. */
  draft: string;
  /** The question in flight, until its stored answer joins the chat. */
  turn: AskTurn | null;
  /** Said to screen readers once a turn settles. */
  announcement: string;
  /** Opens the panel on the last chat with `question` in its field, or asks it in a new chat with `submit`. */
  openAsk: (question?: string, options?: { submit?: boolean }) => void;
  /** Closes the panel. A question in flight keeps streaming into its chat. */
  close: () => void;
  /** The guide article open beside the chat, by slug. */
  guide: string | null;
  openGuide: (slug: string) => void;
  closeGuide: () => void;
  /** Shows the chat `chatId`, or a new one with null, and stops reading the question in flight. */
  startChat: (chatId: string | null) => void;
  send: (question: string, attachments?: MessageFile[]) => void;
  stop: () => void;
};

const AskContext = createContext<AskValue | null>(null);

export function useAsk() {
  const context = use(AskContext);
  if (!context) throw new Error('useAsk must be used inside AskProvider');
  return context;
}

/** Owns Ask Conduit's panel state and the question in flight, so both outlive the panel while it is closed or covered. */
export function AskProvider({ children }: { children: ReactNode }) {
  const available = useAiSettings().data?.aiEnabled === true;
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [guide, setGuide] = useState<string | null>(null);

  const onAnswer = useCallback((answer: Answer) => {
    setChatId(answer.chatId);
    setAnnouncement(answer.found ? 'Answer ready.' : 'No answer found.');
  }, []);
  const { turn, send: sendTurn, stop, clear } = useAskTurn(onAnswer);

  const startChat = useCallback(
    (id: string | null) => {
      clear();
      setChatId(id);
      setAnnouncement('');
    },
    [clear]
  );
  const send = useCallback(
    (question: string, attachments?: MessageFile[]) =>
      void sendTurn(chatId, question, attachments),
    [chatId, sendTurn]
  );
  const openAsk = useCallback(
    (question = '', { submit = false }: { submit?: boolean } = {}) => {
      const text = question.trim();
      setOpen(true);
      if (submit && text) {
        startChat(null);
        setDraft('');
        void sendTurn(null, text);
      } else if (text) {
        setDraft(text);
      }
    },
    [sendTurn, startChat]
  );
  const close = useCallback(() => {
    setOpen(false);
    setGuide(null);
  }, []);
  const closeGuide = useCallback(() => setGuide(null), []);

  const value = useMemo(
    () => ({
      available,
      open,
      chatId,
      draft,
      turn,
      announcement,
      openAsk,
      close,
      guide,
      openGuide: setGuide,
      closeGuide,
      startChat,
      send,
      stop,
    }),
    [
      available,
      open,
      chatId,
      draft,
      turn,
      announcement,
      openAsk,
      close,
      guide,
      closeGuide,
      startChat,
      send,
      stop,
    ]
  );

  return <AskContext value={value}>{children}</AskContext>;
}

/** Where the panel mounts: inside the side card's layout, loaded the first time it opens. */
export function AskPanelSlot() {
  const { available, open } = useAsk();
  const [hasOpened, setHasOpened] = useState(false);
  if (open && !hasOpened) setHasOpened(true);
  return available && hasOpened && <AskPanel />;
}
