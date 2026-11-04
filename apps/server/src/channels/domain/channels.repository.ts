import type { Channel, ChannelMember } from '@conduit/contract';

/** Whose view of a channel to load: the member counts and the `membership` field depend on it. */
export type ChannelScope = { userId: string; organizationId: string };

/** Channels and their members. Every channel it returns is the scope's view of it. */
export abstract class ChannelsRepository {
  /** Public channels plus the private ones the scope's user belongs to. */
  abstract list(scope: ChannelScope, archived: boolean): Promise<Channel[]>;

  /** Any channel in the scope's workspace, private or not. Callers check visibility. */
  abstract find(
    scope: ChannelScope,
    channelId: string
  ): Promise<Channel | null>;

  abstract findOrganizationId(channelId: string): Promise<string | null>;

  /** Creates the channel with its creator as a manager. Throws `NAME_TAKEN`. */
  abstract create(
    scope: ChannelScope,
    input: { name: string; visibility: Channel['visibility'] }
  ): Promise<Channel>;

  /** Throws `NAME_TAKEN`. */
  abstract rename(
    scope: ChannelScope,
    channelId: string,
    name: string
  ): Promise<Channel>;

  /** `undefined` leaves a field alone. */
  abstract updateDetails(
    scope: ChannelScope,
    channelId: string,
    details: { topic?: string | null; description?: string | null }
  ): Promise<Channel>;

  /** Archives as the scope's user, or unarchives. */
  abstract setArchived(
    scope: ChannelScope,
    channelId: string,
    archived: boolean
  ): Promise<Channel>;

  /** Making a channel private also adds the scope's user, so they keep access. */
  abstract setVisibility(
    scope: ChannelScope,
    channelId: string,
    visibility: Channel['visibility']
  ): Promise<Channel>;

  abstract delete(channelId: string): Promise<void>;

  /** Adds each user once. Users already in the channel are skipped. */
  abstract addMembers(channelId: string, userIds: string[]): Promise<void>;

  /** Returns how many members were removed, 0 or 1. */
  abstract removeMember(channelId: string, userId: string): Promise<number>;

  /** The user's own settings on a channel. Does nothing when they are not a member. */
  abstract updateMembership(
    channelId: string,
    userId: string,
    data: { starredAt?: Date | null; sectionId?: string | null }
  ): Promise<void>;

  /** Current workspace members of the channel, managers first. */
  abstract listMembers(
    scope: ChannelScope,
    channelId: string
  ): Promise<ChannelMember[]>;

  /** The member's channel role, or null when they are not a current workspace member in the channel. */
  abstract findMemberRole(
    scope: ChannelScope,
    channelId: string,
    userId: string
  ): Promise<ChannelMember['role'] | null>;

  /** Throws `LAST_MANAGER` when `demotingManager` would leave the channel with none. */
  abstract setMemberRole(
    scope: ChannelScope,
    channelId: string,
    userId: string,
    role: ChannelMember['role'],
    demotingManager: boolean
  ): Promise<void>;
}
