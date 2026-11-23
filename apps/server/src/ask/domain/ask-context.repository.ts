import type {
  AskChannel,
  AskDraft,
  AskPerson,
  MessageHit,
  WorkspaceRole,
} from '@conduit/contract';

/** A channel as Ask Conduit's `channel` tool reads it. */
export type ChannelFacts = AskChannel & {
  description: string | null;
  visibility: 'public' | 'private';
  archived: boolean;
  memberCount: number;
  /** Names, managers first. At most `ASK_CHANNEL_MEMBERS_MAX`. */
  members: { name: string; manager: boolean }[];
};

/** A member as Ask Conduit's `people` tool reads them. No email, no invitation, nothing from settings. */
export type PersonFacts = AskPerson & { role: WorkspaceRole };

/**
 * What Ask Conduit's tools read beyond search. Every method takes the room ids from `channelIds`, so a DM, or a
 * private channel the asker isn't in, never reaches the model.
 */
export abstract class AskContextRepository {
  /** The channels the user can open, archived ones included. Never a DM. */
  abstract channelIds(
    organizationId: string,
    userId: string
  ): Promise<string[]>;

  /** Channels among `roomIds` whose name contains `text`, case aside. */
  abstract channels(
    roomIds: string[],
    text: string,
    limit: number
  ): Promise<ChannelFacts[]>;

  /** The channels with these ids that are among `roomIds`. */
  abstract channelsById(
    roomIds: string[],
    ids: string[]
  ): Promise<AskChannel[]>;

  /** Active members whose name contains `text`, case aside. */
  abstract people(
    organizationId: string,
    text: string,
    limit: number
  ): Promise<PersonFacts[]>;

  /** The active members with these user ids. */
  abstract peopleById(
    organizationId: string,
    ids: string[]
  ): Promise<AskPerson[]>;

  /** The thread a message is in, root first then replies oldest first, or nothing when it is outside `roomIds`. */
  abstract thread(
    roomIds: string[],
    messageId: string,
    limit: number
  ): Promise<MessageHit[]>;

  /** The user's saved messages among `roomIds`, newest saved first. */
  abstract saved(
    userId: string,
    roomIds: string[],
    limit: number
  ): Promise<MessageHit[]>;

  /** The user's own drafts among `roomIds` that hold text, newest first. */
  abstract drafts(
    userId: string,
    roomIds: string[],
    limit: number
  ): Promise<AskDraft[]>;
}
