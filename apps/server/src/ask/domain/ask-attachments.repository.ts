/** A file the asker attached to an Ask question. */
export type StoredAskAttachment = {
  id: string;
  organizationId: string;
  ownerId: string;
  /** Null until a question carries it, and again once its chat is deleted. */
  answerId: string | null;
  /** The uploaded object. Null when `fileId` is set. */
  key: string | null;
  /** The sent file the asker picked from Files, read in place. Null for an upload. */
  fileId: string | null;
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
  'id' | 'organizationId' | 'ownerId' | 'name' | 'contentType' | 'size'
> &
  (
    | { key: string }
    | (Pick<StoredAskAttachment, 'width' | 'height'> & {
        fileId: string;
        ready: true;
      })
  );

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
