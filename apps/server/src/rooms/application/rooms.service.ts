import {
  checkChannel,
  type NotifyLevel,
  type RoomMember,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { roomError } from '@/rooms/domain/room-errors';
import {
  type MembershipPatch,
  RoomsRepository,
} from '@/rooms/domain/rooms.repository';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

export type RoomViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

/** What every room answers, a channel or a DM: the record and its members, to viewers who may see it. */
@Injectable()
export class RoomsService {
  constructor(
    @Inject(RoomsRepository) private readonly rooms: RoomsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly workspaceMembers: WorkspaceMembersRepository
  ) {}

  /** Resolves a room in any workspace the caller belongs to, so a copied link can switch workspace. */
  async get(userId: string, roomId: string) {
    const organizationId = await this.rooms.findOrganizationId(roomId);
    const workspaceRole =
      organizationId &&
      (await this.workspaceMembers.findRole(organizationId, userId));
    if (!organizationId || !workspaceRole) {
      throw roomError('NOT_FOUND');
    }
    return this.find({ userId, organizationId, workspaceRole }, roomId);
  }

  async listMembers(viewer: RoomViewer, roomId: string): Promise<RoomMember[]> {
    await this.find(viewer, roomId);
    return this.rooms.listMembers(viewer, roomId);
  }

  /** A null level goes back to the default for the room's kind. Only a member has a level to set. */
  setNotify(viewer: RoomViewer, roomId: string, level: NotifyLevel | null) {
    return this.updateOwnMembership(viewer, roomId, { notify: level });
  }

  mute(viewer: RoomViewer, roomId: string) {
    return this.updateOwnMembership(viewer, roomId, { mutedAt: new Date() });
  }

  unmute(viewer: RoomViewer, roomId: string) {
    return this.updateOwnMembership(viewer, roomId, { mutedAt: null });
  }

  private async updateOwnMembership(
    viewer: RoomViewer,
    roomId: string,
    patch: MembershipPatch
  ) {
    const room = await this.find(viewer, roomId);
    if (!room.membership) {
      throw roomError('NOT_FOUND');
    }
    await this.rooms.updateMembership(roomId, viewer.userId, patch);
  }

  /** A room the viewer cannot see is NOT_FOUND, so private channels do not leak. */
  async find(viewer: RoomViewer, roomId: string) {
    const room = await this.rooms.find(viewer, roomId);
    if (!room || checkChannel('view', viewer.workspaceRole, room)) {
      throw roomError('NOT_FOUND');
    }
    return room;
  }
}
