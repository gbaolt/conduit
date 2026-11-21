import type {
  ChannelHit,
  ListedFile,
  MessageHit,
  PersonHit,
} from '@conduit/contract';

/** What a search narrows to once its filters are resolved. `roomIds` are already limited to rooms the caller reads. */
export type SearchScope = {
  organizationId: string;
  roomIds: string[];
  /** Empty means anyone. */
  authorIds: string[];
  hasFile: boolean;
  /** Inclusive. */
  from?: Date;
  /** Exclusive. */
  until?: Date;
};

/** The Postgres side of search. Every method returns only live rows inside the scope it is given. */
export abstract class SearchRepository {
  /** Channels in the workspace whose names match, case aside. */
  abstract channelIdsNamed(
    organizationId: string,
    names: string[]
  ): Promise<string[]>;

  /** Members whose full name, first name, or email name matches, case aside. */
  abstract userIdsNamed(
    organizationId: string,
    names: string[]
  ): Promise<string[]>;

  /** The viewer's one-to-one DMs with these people, or the self DM when the person is the viewer. */
  abstract dmIdsWith(
    organizationId: string,
    viewerId: string,
    userIds: string[]
  ): Promise<string[]>;

  /** The messages with these ids that are in scope and not deleted, in the order of `ids`. */
  abstract messages(scope: SearchScope, ids: string[]): Promise<MessageHit[]>;

  /** The sent files with these ids that are in scope and not deleted, in the order of `ids`. */
  abstract files(scope: SearchScope, ids: string[]): Promise<ListedFile[]>;

  /** The newest messages in scope, for a query that is filters alone. */
  abstract recentMessages(
    scope: SearchScope,
    limit: number
  ): Promise<MessageHit[]>;

  abstract recentFiles(
    scope: SearchScope,
    limit: number
  ): Promise<ListedFile[]>;

  /** Unarchived channels among `roomIds` whose names contain `text`. */
  abstract channels(
    organizationId: string,
    viewerId: string,
    roomIds: string[],
    text: string,
    limit: number
  ): Promise<ChannelHit[]>;

  /** Active members whose name or email contains `text`. */
  abstract people(
    organizationId: string,
    text: string,
    limit: number
  ): Promise<PersonHit[]>;
}
