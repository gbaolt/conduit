import type { Dm, Room } from '@conduit/contract';

import type { RoomScope } from '../../rooms/domain/rooms.repository';

/** Direct conversations. Each is a `Room` row with `kind: DM`, so callers check access through `ChannelsRepository` first. */
export abstract class DmsRepository {
  /** The scope user's DMs, the most recent message first. */
  abstract list(scope: RoomScope): Promise<Dm[]>;

  /**
   * Finds or creates the DM for exactly these people, and makes sure each one is in it.
   * `userIds` holds the scope user. Opening the same set twice, even at once, returns one DM.
   * Also clears the scope user's close, so a DM they closed shows again.
   */
  abstract open(scope: RoomScope, userIds: string[]): Promise<Dm>;

  /**
   * Closes the scope user's own side of each id that is a DM they are in, in the scope's workspace, and
   * skips every other id. A message sent after the close opens the DM again.
   */
  abstract close(scope: RoomScope, roomIds: string[]): Promise<void>;

  /**
   * Adds people and rekeys the DM to the new set, under a lock on the DM.
   * Throws `DM_FULL` past ten people, and `DM_EXISTS` when a DM already holds exactly the new set.
   */
  abstract addPeople(
    scope: RoomScope,
    roomId: string,
    userIds: string[]
  ): Promise<Dm>;

  /**
   * Makes the DM a private channel called `name`, clears its key, and makes the scope user its manager.
   * Every message and member stays. Throws `NAME_TAKEN`, and `NOT_FOUND` when the channel is not a DM.
   */
  abstract convertToChannel(
    scope: RoomScope,
    roomId: string,
    name: string
  ): Promise<Room>;
}
