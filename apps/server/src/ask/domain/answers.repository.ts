/** A cited source as stored: what it was, never its text, so a later read checks access again. */
export type AnswerRef = { type: 'message' | 'file'; id: string };

export type StoredAnswer = {
  id: string;
  chatId: string;
  question: string;
  found: boolean;
  /** Each `[n]` cites `sources[n - 1]`. */
  body: string;
  sources: AnswerRef[];
  createdAt: Date;
};

export type NewAnswer = Omit<StoredAnswer, 'id' | 'chatId' | 'createdAt'>;

export type StoredChat = {
  id: string;
  organizationId: string;
  ownerId: string;
  title: string;
  updatedAt: Date;
};

/** Where an answer goes: the chat it continues, or a chat it starts. */
export type AnswerTarget =
  | { chatId: string }
  | { newChat: Pick<StoredChat, 'organizationId' | 'ownerId' | 'title'> };

/** Ask chats, their answers, and the names of the people their sources mention. Callers check access first. */
export abstract class AnswersRepository {
  /** Stores the answer, with its new chat in the same transaction, and moves the chat to the top of the history. */
  abstract addAnswer(
    target: AnswerTarget,
    answer: NewAnswer
  ): Promise<StoredAnswer>;

  /** The chat with its answers, oldest first. */
  abstract findChat(
    chatId: string
  ): Promise<(StoredChat & { answers: StoredAnswer[] }) | null>;

  /** The owner's newest chats in the workspace. */
  abstract listChats(
    organizationId: string,
    ownerId: string,
    limit: number
  ): Promise<StoredChat[]>;

  abstract deleteChat(chatId: string): Promise<void>;

  /** Display names by user id. A user who no longer exists has no entry. */
  abstract userNames(userIds: string[]): Promise<Map<string, string>>;
}
