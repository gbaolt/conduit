import {
  canCanvas,
  type CanvasAccess,
  type CanvasAction,
  type CanvasRole,
  type CanvasScope,
  checkCanvas,
  type CreateCanvasInput,
  type PolicyCanvas,
  type Room,
  type SaveCanvasSnapshotInput,
  type ShareCanvasInput,
  type UpdateCanvasInput,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { canvasError } from '@/canvases/domain/canvas-errors';
import {
  CanvasesRepository,
  type StoredCanvas,
} from '@/canvases/domain/canvases.repository';
import {
  cursorColorOf,
  type LiveblocksPermission,
  LiveblocksPort,
  liveblocksRoomId,
} from '@/canvases/domain/liveblocks.port';
import { RoomsRepository } from '@/rooms/domain/rooms.repository';
import { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

export type CanvasViewerScope = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

const UNTITLED = 'Untitled';

const READ: LiveblocksPermission[] = ['room:read', 'room:presence:write'];
const WRITE: LiveblocksPermission[] = [...READ, 'room:write'];

@Injectable()
export class CanvasesService {
  private readonly logger = new Logger(CanvasesService.name);

  constructor(
    @Inject(CanvasesRepository) private readonly canvases: CanvasesRepository,
    @Inject(RoomsRepository) private readonly rooms: RoomsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly workspaceMembers: WorkspaceMembersRepository,
    @Inject(LiveblocksPort) private readonly liveblocks: LiveblocksPort
  ) {}

  private policyCanvas(canvas: StoredCanvas, room: Room | null): PolicyCanvas {
    return {
      createdById: canvas.createdById,
      channel: room,
      membership: canvas.viewerRole && { role: canvas.viewerRole },
    };
  }

  private withAccess<T extends StoredCanvas>(
    viewer: CanvasViewerScope,
    canvas: T,
    room: Room | null
  ) {
    const policy = this.policyCanvas(canvas, room);
    const can = (action: CanvasAction) => canCanvas(action, viewer, policy);
    const access: CanvasAccess = {
      edit: can('edit'),
      manageSharing: can('manageSharing'),
      delete: can('delete'),
    };
    // The contract's output schema drops `viewerRole`, and `snapshotJson` where it is not asked for.
    return { ...canvas, access };
  }

  /** The canvas and its channel, when the viewer may take `action` on it. Refuses with `NOT_FOUND` when they cannot read it. */
  private async load(
    viewer: CanvasViewerScope,
    canvasId: string,
    action: CanvasAction
  ) {
    const canvas = await this.canvases.find(viewer, canvasId);
    const room = canvas?.roomId
      ? await this.rooms.find(viewer, canvas.roomId)
      : null;
    if (!canvas || (canvas.roomId && !room)) throw canvasError('NOT_FOUND');
    const denial = checkCanvas(action, viewer, this.policyCanvas(canvas, room));
    if (denial) throw canvasError(denial);
    return { canvas, room };
  }

  /** A channel the viewer can read, or `NOT_FOUND`. A DM has no canvas. */
  private async readableChannel(viewer: CanvasViewerScope, roomId: string) {
    const room = await this.rooms.find(viewer, roomId);
    if (
      !room ||
      room.kind !== 'channel' ||
      !canCanvas('view', viewer, {
        createdById: null,
        channel: room,
        membership: null,
      })
    ) {
      throw canvasError('NOT_FOUND');
    }
    return room;
  }

  async getChannelCanvas(viewer: CanvasViewerScope, roomId: string) {
    const room = await this.readableChannel(viewer, roomId);
    const canvas = await this.canvases.findChannelPrimary(viewer, roomId);
    return canvas && this.withAccess(viewer, canvas, room);
  }

  async get(viewer: CanvasViewerScope, canvasId: string) {
    const { canvas, room } = await this.load(viewer, canvasId, 'view');
    return this.withAccess(viewer, canvas, room);
  }

  async list(viewer: CanvasViewerScope, scope: CanvasScope) {
    const [active, archived] = await Promise.all([
      this.rooms.list(viewer, false),
      this.rooms.list(viewer, true),
    ]);
    const rooms = new Map(
      [...active, ...archived].map((room) => [room.id, room])
    );
    const canvases = await this.canvases.list(viewer, [...rooms.keys()], scope);
    return canvases.map((canvas) =>
      this.withAccess(
        viewer,
        canvas,
        canvas.roomId ? (rooms.get(canvas.roomId) ?? null) : null
      )
    );
  }

  async create(viewer: CanvasViewerScope, input: CreateCanvasInput) {
    const title = input.title || UNTITLED;
    if (!input.roomId) {
      const id = await this.canvases.createStandalone(viewer, title);
      return this.get(viewer, id);
    }

    const room = await this.readableChannel(viewer, input.roomId);
    const existing = await this.canvases.findChannelPrimary(viewer, room.id);
    if (existing) return this.withAccess(viewer, existing, room);

    const denial = checkCanvas('edit', viewer, {
      createdById: viewer.userId,
      channel: room,
      membership: null,
    });
    if (denial) throw canvasError(denial);
    const id = await this.canvases.createChannelPrimary(
      viewer,
      room.id,
      input.title || room.name
    );
    return this.get(viewer, id);
  }

  async update(viewer: CanvasViewerScope, input: UpdateCanvasInput) {
    const { canvasId, ...patch } = input;
    await this.load(viewer, canvasId, 'edit');
    if (patch.title !== undefined) patch.title = patch.title || UNTITLED;
    await this.canvases.update(viewer, canvasId, patch);
    return this.get(viewer, canvasId);
  }

  async delete(viewer: CanvasViewerScope, canvasId: string) {
    await this.load(viewer, canvasId, 'delete');
    await this.canvases.softDelete(canvasId);
    const roomId = liveblocksRoomId(viewer.organizationId, canvasId);
    // Postgres already refuses the canvas, so a room left behind holds content nobody can open.
    await this.liveblocks.deleteRoom(roomId).catch((error: unknown) => {
      this.logger.warn(`Could not delete Liveblocks room ${roomId}: ${error}`);
    });
  }

  /** A token for the canvas's room alone: write access for editors, read and cursors for everyone else. */
  async liveblocksAuth(
    viewer: CanvasViewerScope,
    canvasId: string,
    user: { name: string; image?: string | null }
  ) {
    const { canvas, room } = await this.load(viewer, canvasId, 'view');
    if (!this.liveblocks.enabled) return { enabled: false as const };
    const canEdit = canCanvas('edit', viewer, this.policyCanvas(canvas, room));
    const roomId = liveblocksRoomId(viewer.organizationId, canvasId);
    const color = cursorColorOf(viewer.userId);
    const token = await this.liveblocks.authorize(
      viewer.userId,
      { name: user.name, image: user.image ?? null, color },
      roomId,
      canEdit ? WRITE : READ
    );
    return { enabled: true as const, token, roomId, color };
  }

  /** Lets one editor seed the canvas's empty live document. Anyone else, and every viewer, gets `claimed: false`. */
  async claimBootstrap(viewer: CanvasViewerScope, canvasId: string) {
    const { canvas, room } = await this.load(viewer, canvasId, 'view');
    const unclaimed = {
      claimed: false,
      snapshotJson: null,
      initialMarkdown: null,
    };
    if (!canCanvas('edit', viewer, this.policyCanvas(canvas, room))) {
      return unclaimed;
    }
    const seed = await this.canvases.claimBootstrap(canvasId);
    return seed ? { claimed: true, ...seed } : unclaimed;
  }

  async saveSnapshot(
    viewer: CanvasViewerScope,
    input: SaveCanvasSnapshotInput
  ) {
    const { canvasId, ...snapshot } = input;
    await this.load(viewer, canvasId, 'edit');
    return this.canvases.saveSnapshot(viewer, canvasId, snapshot);
  }

  async listMembers(viewer: CanvasViewerScope, canvasId: string) {
    const { canvas } = await this.load(viewer, canvasId, 'view');
    return canvas.roomId ? [] : this.canvases.listMembers(viewer, canvasId);
  }

  async share(viewer: CanvasViewerScope, input: ShareCanvasInput) {
    await this.load(viewer, input.canvasId, 'manageSharing');
    const userIds = [...new Set(input.userIds)];
    const members = await this.workspaceMembers.count(
      viewer.organizationId,
      userIds
    );
    if (members !== userIds.length) throw canvasError('NOT_A_MEMBER');
    await this.canvases.share(viewer, input.canvasId, userIds, input.role);
  }

  async updateMemberRole(
    viewer: CanvasViewerScope,
    input: { canvasId: string; userId: string; role: CanvasRole }
  ) {
    await this.load(viewer, input.canvasId, 'manageSharing');
    await this.canvases.setMemberRole(
      viewer,
      input.canvasId,
      input.userId,
      input.role
    );
  }

  async removeMember(
    viewer: CanvasViewerScope,
    input: { canvasId: string; userId: string }
  ) {
    const { canvas } = await this.load(
      viewer,
      input.canvasId,
      input.userId === viewer.userId ? 'view' : 'manageSharing'
    );
    if (canvas.roomId) throw canvasError('FORBIDDEN');
    await this.canvases.removeMember(viewer, input.canvasId, input.userId);
  }
}
