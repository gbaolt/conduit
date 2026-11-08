import type { Dm, Room } from '@conduit/contract';

import type { ChannelScope } from './channels.repository';

/** Direct conversations. Each is a `Room` row with `kind: DM`, so callers check access through `ChannelsRepository` first. */
export abstract class DmsRepository {
  /** The scope user's DMs, the most recent message first. */
  abstract list(scope: ChannelScope): Promise<Dm[]>;

  /**
   * Finds or creates the DM for exactly these people, and makes sure each one is in it.
   * `userIds` holds the scope user. Opening the same set twice, even at once, returns one DM.
   */
  abstract open(scope: ChannelScope, userIds: string[]): Promise<Dm>;

  /**
   * Adds people and rekeys the DM to the new set, under a lock on the DM.
   * Throws `DM_FULL` past ten people, and `DM_EXISTS` when a DM already holds exactly the new set.
   */
  abstract addPeople(
    scope: ChannelScope,
    roomId: string,
    userIds: string[]
  ): Promise<Dm>;

  /**
   * Makes the DM a private channel called `name`, clears its key, and makes the scope user its manager.
   * Every message and member stays. Throws `NAME_TAKEN`, and `NOT_FOUND` when the channel is not a DM.
   */
  abstract convertToChannel(
    scope: ChannelScope,
    roomId: string,
    name: string
  ): Promise<Room>;
}
