import { createHash } from 'node:crypto';

import {
  canCanvas,
  CANVAS_LINK_EXCERPT_MAX,
  CANVAS_UNTITLED,
  type CanvasAccess,
  type CanvasAction,
  type CanvasLinkCardResult,
  type CanvasRole,
  type CanvasScope,
  checkCanvas,
  type CreateCanvasInput,
  type EmbeddedMessage,
  plainText,
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
  autoVersionDue,
  type CanvasVersionContent,
  CanvasVersionsRepository,
} from '@/canvases/domain/canvas-versions.repository';
import {
  CanvasesRepository,
  type CanvasSeed,
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

/** The hash the editor sends with a snapshot: SHA-256 of its JSON, as hex. */
export function contentHashOf(snapshotJson: Record<string, unknown>) {
  return createHash('sha256')
    .update(JSON.stringify(snapshotJson))
    .digest('hex');
}

// Liveblocks rejects passing both room:read and room:write; room:write implies read and presence.
const READ: LiveblocksPermission[] = ['room:read', 'room:presence:write'];
const WRITE: LiveblocksPermission[] = ['room:write'];

function canvasExcerpt(markdown: string) {
  const content = markdown
    // Canvas exports toggles as HTML and tables as pipe-delimited rows.
    .replace(/<\/?(?:details|summary)>/gi, ' ')
    .replace(/^[ \t]*\|(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$/gm, '')
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_match, cells: string) =>
      cells.replace(/(?<!\\)\|/g, ' ').replace(/\\\|/g, '|')
    )
    .replace(/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+/gm, '')
    .replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, '');
  return plainText(content, {})
    .slice(0, CANVAS_LINK_EXCERPT_MAX)
    .replace(/\p{Surrogate}$/u, '')
    .trimEnd();
}

@Injectable()
export class CanvasesService {
  private readonly logger = new Logger(CanvasesService.name);

  constructor(
    @Inject(CanvasesRepository) private readonly canvases: CanvasesRepository,
    @Inject(RoomsRepository) private readonly rooms: RoomsRepository,
    @Inject(WorkspaceMembersRepository)
    private readonly workspaceMembers: WorkspaceMembersRepository,
    @Inject(LiveblocksPort) private readonly liveblocks: LiveblocksPort,
    @Inject(CanvasVersionsRepository)
    private readonly versions: CanvasVersionsRepository
  ) {}

  private policyCanvas(canvas: StoredCanvas, room: Room | null): PolicyCanvas {
    return {
      createdById: canvas.createdById,
      channel: room,
      membership: canvas.viewerRole && { role: canvas.viewerRole },
    };
  }

  private async canvasAccessContext(
    viewer: CanvasViewerScope,
    canvas: StoredCanvas
  ) {
    const room = canvas.roomId
      ? await this.rooms.find(viewer, canvas.roomId)
      : null;
    if (canvas.roomId && !room) return null;
    return { room, policy: this.policyCanvas(canvas, room) };
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
      comment: can('comment'),
      manageSharing: can('manageSharing'),
      delete: can('delete'),
    };
    // The contract's output schema drops `viewerRole`, and `snapshotJson` where it is not asked for.
    return { ...canvas, access };
  }

  /** The canvas and its channel, when the viewer may take `action` on it. Refuses with `NOT_FOUND` when they cannot read it. */
  async load(
    viewer: CanvasViewerScope,
    canvasId: string,
    action: CanvasAction
  ) {
    const canvas = await this.canvases.find(viewer, canvasId);
    if (!canvas) throw canvasError('NOT_FOUND');
    const access = await this.canvasAccessContext(viewer, canvas);
    if (!access) throw canvasError('NOT_FOUND');
    const denial = checkCanvas(action, viewer, access.policy);
    if (denial) throw canvasError(denial);
    return { canvas, room: access.room };
  }

  /** A channel the viewer can read, or `NOT_FOUND`. A DM has no canvas. */
  private async readableRoom(viewer: CanvasViewerScope, roomId: string) {
    const room = await this.rooms.find(viewer, roomId);
    if (
      !room ||
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

  async listRoomCanvases(viewer: CanvasViewerScope, roomId: string) {
    const room = await this.readableRoom(viewer, roomId);
    const canvases = await this.canvases.listInChannel(viewer, roomId);
    return canvases.map((canvas) => this.withAccess(viewer, canvas, room));
  }

  async get(viewer: CanvasViewerScope, canvasId: string) {
    const { canvas, room } = await this.load(viewer, canvasId, 'view');
    return this.withAccess(viewer, canvas, room);
  }

  async list(viewer: CanvasViewerScope, scope: CanvasScope) {
    const [active, archived, roomIds] = await Promise.all([
      this.rooms.list(viewer, false),
      this.rooms.list(viewer, true),
      this.rooms.accessibleRoomIds(viewer),
    ]);
    const rooms = new Map(
      [...active, ...archived].map((room) => [room.id, room])
    );
    const canvases = await this.canvases.list(viewer, roomIds, scope);
    // The channel lists leave out DMs, so the few DMs that hold canvases are read one by one.
    const dmIds = new Set(
      canvases.flatMap(({ roomId }) =>
        roomId && !rooms.has(roomId) ? [roomId] : []
      )
    );
    const dms = await Promise.all(
      [...dmIds].map((roomId) => this.rooms.find(viewer, roomId))
    );
    for (const dm of dms) if (dm) rooms.set(dm.id, dm);
    // A room canvas never falls back to the standalone rules, so one whose room vanished meanwhile is dropped.
    return canvases
      .flatMap((canvas) =>
        canvas.roomId && !rooms.has(canvas.roomId) ? [] : [canvas]
      )
      .map((canvas) =>
        this.withAccess(
          viewer,
          canvas,
          canvas.roomId ? (rooms.get(canvas.roomId) ?? null) : null
        )
      );
  }

  async create(viewer: CanvasViewerScope, input: CreateCanvasInput) {
    const {
      title,
      roomId,
      sourceMessageIds = [],
      versionTrigger,
      ...content
    } = input;
    const seed: CanvasSeed = {
      ...content,
      contentHash: content.snapshotJson && contentHashOf(content.snapshotJson),
    };
    await this.assertReadableMessages(viewer, [
      ...(content.sourceThreadId ? [content.sourceThreadId] : []),
      ...sourceMessageIds,
    ]);

    let id: string;
    if (!roomId) {
      id = await this.canvases.createStandalone(
        viewer,
        title || CANVAS_UNTITLED,
        seed
      );
    } else {
      const room = await this.readableRoom(viewer, roomId);
      const denial = checkCanvas('edit', viewer, {
        createdById: viewer.userId,
        channel: room,
        membership: null,
      });
      if (denial) throw canvasError(denial);
      id = await this.canvases.createInChannel(
        viewer,
        room.id,
        title || CANVAS_UNTITLED,
        seed
      );
    }

    if (versionTrigger && seed.snapshotJson && seed.contentHash) {
      await this.versions
        .create({
          canvasId: id,
          organizationId: viewer.organizationId,
          // An AI draft has no author; the history shows it as "AI draft".
          authorId: null,
          label: null,
          trigger: versionTrigger,
          snapshotJson: seed.snapshotJson,
          markdown: seed.markdown ?? '',
          contentHash: seed.contentHash,
        })
        .catch((error: unknown) => {
          // The canvas is already created, so a missing first version must not make the client create it twice.
          this.logger.warn(`Could not record version 1 of ${id}: ${error}`);
        });
    }
    return this.get(viewer, id);
  }

  /** Refuses with `NOT_FOUND` unless every message exists in the workspace, in a room the viewer reads. */
  private async assertReadableMessages(
    viewer: CanvasViewerScope,
    messageIds: string[]
  ) {
    if (messageIds.length === 0) return;
    const ids = [...new Set(messageIds)];
    const [roomIds, found] = await Promise.all([
      this.rooms.accessibleRoomIds(viewer),
      this.canvases.findMessages(viewer.organizationId, ids),
    ]);
    const readable = new Set(roomIds);
    if (
      found.length !== ids.length ||
      found.some(({ message }) => !readable.has(message.room.id))
    ) {
      throw canvasError('NOT_FOUND');
    }
  }

  async update(viewer: CanvasViewerScope, input: UpdateCanvasInput) {
    const { canvasId, ...patch } = input;
    await this.load(viewer, canvasId, 'edit');
    if (patch.title !== undefined) patch.title = patch.title || CANVAS_UNTITLED;
    await this.canvases.update(viewer, canvasId, patch);
    if (patch.snapshotJson) {
      await this.checkpoint(viewer, canvasId, {
        snapshotJson: patch.snapshotJson,
        markdown: patch.markdown ?? '',
        contentHash: contentHashOf(patch.snapshotJson),
      });
    }
    return this.get(viewer, canvasId);
  }

  /** Records an autosave version when the content changed and the last version is 5 minutes old. */
  private async checkpoint(
    viewer: CanvasViewerScope,
    canvasId: string,
    content: CanvasVersionContent
  ) {
    const now = new Date();
    // The edit is already saved, so a failed checkpoint must not report the save as failed.
    await this.versions
      .createIfDue(
        {
          ...content,
          canvasId,
          organizationId: viewer.organizationId,
          authorId: viewer.userId,
          label: null,
          trigger: 'auto',
        },
        (latest) => autoVersionDue(latest, content.contentHash, now)
      )
      .catch((error: unknown) => {
        this.logger.warn(`Could not checkpoint canvas ${canvasId}: ${error}`);
      });
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
    const saved = await this.canvases.saveSnapshot(viewer, canvasId, snapshot);
    await this.checkpoint(viewer, canvasId, snapshot);
    return saved;
  }

  async listMembers(viewer: CanvasViewerScope, canvasId: string) {
    const { canvas } = await this.load(viewer, canvasId, 'view');
    return canvas.roomId ? [] : this.canvases.listMembers(viewer, canvasId);
  }

  /**
   * The embedded messages, checked against every room the viewer may read. A message outside them is
   * `inaccessible` even when it was deleted, so a refusal never says what happened to it.
   */
  async embeddedMessages(
    viewer: CanvasViewerScope,
    input: { canvasId: string; messageIds: string[] }
  ): Promise<EmbeddedMessage[]> {
    await this.load(viewer, input.canvasId, 'view');
    const [roomIds, stored] = await Promise.all([
      this.rooms.accessibleRoomIds(viewer),
      this.canvases.findMessages(viewer.organizationId, [
        ...new Set(input.messageIds),
      ]),
    ]);
    const readable = new Set(roomIds);
    const byId = new Map(stored.map((each) => [each.message.id, each]));
    return input.messageIds.map((messageId) => {
      const found = byId.get(messageId);
      if (!found) return { messageId, status: 'deleted' };
      if (!readable.has(found.message.room.id)) {
        return { messageId, status: 'inaccessible' };
      }
      if (found.deletedAt) return { messageId, status: 'deleted' };
      return { messageId, status: 'ok', message: found.message };
    });
  }

  async linkCard(
    viewer: CanvasViewerScope,
    canvasId: string
  ): Promise<CanvasLinkCardResult> {
    const canvas = await this.canvases.findForLink(viewer, canvasId);
    if (!canvas) return { status: 'inaccessible' };
    const access = await this.canvasAccessContext(viewer, canvas);
    if (!access || !canCanvas('view', viewer, access.policy)) {
      return { status: 'inaccessible' };
    }
    if (canvas.deletedAt) return { status: 'deleted' };

    return {
      status: 'ok',
      canvas: {
        id: canvas.id,
        title: canvas.title,
        icon: canvas.icon,
        coverPreset: canvas.coverPreset,
        roomId: canvas.roomId,
        roomKind: canvas.roomKind,
        roomName: canvas.roomName,
        excerpt: canvasExcerpt(canvas.markdown),
        updatedAt: canvas.updatedAt,
        updatedByName: canvas.updatedByName,
      },
    };
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
