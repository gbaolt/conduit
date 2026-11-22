/** A file the asker attached to an Ask question. */
export type StoredAskAttachment = {
  id: string;
  organizationId: string;
  ownerId: string;
  /** Null until a question carries it, and again once its chat is deleted. */
  answerId: string | null;
  key: string;
  name: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  /** True once storage holds the promised bytes. */
  ready: boolean;
  createdAt: Date;
};

export type NewAskAttachment = Pick<
  StoredAskAttachment,
  'id' | 'organizationId' | 'ownerId' | 'key' | 'name' | 'contentType' | 'size'
>;

/** Ask attachments through their upload. `AnswersRepository.addAnswer` links them to the answer. */
export abstract class AskAttachmentsRepository {
  abstract create(attachment: NewAskAttachment): Promise<void>;

  abstract find(id: string): Promise<StoredAskAttachment | null>;

  abstract markReady(
    id: string,
    dimensions: { width: number | null; height: number | null }
  ): Promise<StoredAskAttachment>;

  /** The owner's ready attachments with these ids that no question carries yet, in the order of `ids`. */
  abstract unsent(
    organizationId: string,
    ownerId: string,
    ids: string[]
  ): Promise<StoredAskAttachment[]>;

  /** Attachments no question carries, created before `before`: abandoned uploads and those of deleted chats. */
  abstract sweepable(
    before: Date,
    limit: number
  ): Promise<Pick<StoredAskAttachment, 'id' | 'key'>[]>;

  abstract purge(ids: string[]): Promise<void>;
}
