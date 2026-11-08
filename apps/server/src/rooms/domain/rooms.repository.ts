import type { Room, RoomMember } from '@conduit/contract';

/** Whose view of a channel to load: the member counts and the `membership` field depend on it. */
export type RoomScope = { userId: string; organizationId: string };

/** Channels and their members. Every channel it returns is the scope's view of it. */
export abstract class RoomsRepository {
  /** Public channels plus the private ones the scope's user belongs to. */
  abstract list(scope: RoomScope, archived: boolean): Promise<Room[]>;

  /** Any channel in the scope's workspace, private or not. Callers check visibility. */
  abstract find(scope: RoomScope, roomId: string): Promise<Room | null>;

  abstract findOrganizationId(roomId: string): Promise<string | null>;

  /** Creates the channel with its creator as a manager. Throws `NAME_TAKEN`. */
  abstract create(
    scope: RoomScope,
    input: { name: string; visibility: Room['visibility'] }
  ): Promise<Room>;

  /** Throws `NAME_TAKEN`. */
  abstract rename(
    scope: RoomScope,
    roomId: string,
    name: string
  ): Promise<Room>;

  /** `undefined` leaves a field alone. */
  abstract updateDetails(
    scope: RoomScope,
    roomId: string,
    details: { topic?: string | null; description?: string | null }
  ): Promise<Room>;

  /** Archives as the scope's user, or unarchives. */
  abstract setArchived(
    scope: RoomScope,
    roomId: string,
    archived: boolean
  ): Promise<Room>;

  /** Making a channel private also adds the scope's user, so they keep access. */
  abstract setVisibility(
    scope: RoomScope,
    roomId: string,
    visibility: Room['visibility']
  ): Promise<Room>;

  abstract delete(roomId: string): Promise<void>;

  /** Adds each user once. Users already in the channel are skipped. */
  abstract addMembers(roomId: string, userIds: string[]): Promise<void>;

  /** Returns how many members were removed, 0 or 1. */
  abstract removeMember(roomId: string, userId: string): Promise<number>;

  /** The user's own settings on a channel. Does nothing when they are not a member. */
  abstract updateMembership(
    roomId: string,
    userId: string,
    data: { starredAt?: Date | null; sectionId?: string | null }
  ): Promise<void>;

  /** Current workspace members of the channel, managers first. */
  abstract listMembers(scope: RoomScope, roomId: string): Promise<RoomMember[]>;

  /** The member's channel role, or null when they are not a current workspace member in the channel. */
  abstract findMemberRole(
    scope: RoomScope,
    roomId: string,
    userId: string
  ): Promise<RoomMember['role'] | null>;

  /** Throws `LAST_MANAGER` when `demotingManager` would leave the channel with none. */
  abstract setMemberRole(
    scope: RoomScope,
    roomId: string,
    userId: string,
    role: RoomMember['role'],
    demotingManager: boolean
  ): Promise<void>;
}
