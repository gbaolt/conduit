import type {
  Canvas,
  CanvasBootstrap,
  CanvasCoverPreset,
  CanvasDocument,
  CanvasMember,
  CanvasRole,
  CanvasScope,
  MessageHit,
  PolicyChannel,
} from '@conduit/contract';

/** A canvas row as the app sees it, before the viewer's `access` is worked out. */
export type StoredCanvas = Omit<Canvas, 'access'> & {
  /** The viewer's share on a standalone canvas. */
  viewerRole: CanvasRole | null;
};

export type CanvasMeta = StoredCanvas & { roomPolicy: PolicyChannel | null };

export type StoredCanvasDocument = CanvasMeta &
  Pick<CanvasDocument, 'snapshotJson' | 'markdown'>;

export type StoredCanvasForLink = CanvasMeta &
  Pick<CanvasDocument, 'markdown'> & { deletedAt: Date | null };

/** Whose view of a canvas to load: `viewerRole` depends on it. */
export type CanvasScopeOf = { userId: string; organizationId: string };

export type CanvasPatch = {
  title?: string;
  icon?: string | null;
  coverPreset?: CanvasCoverPreset | null;
  snapshotJson?: Record<string, unknown>;
  markdown?: string;
};

/** A message a canvas embeds, before the viewer's access to its room is checked. */
export type StoredEmbeddedMessage = {
  message: MessageHit;
  deletedAt: Date | null;
};

export type CanvasSnapshot = {
  snapshotJson: Record<string, unknown>;
  markdown: string;
  contentHash: string;
};

/** What a new canvas starts with, such as an AI draft. Empty for a blank canvas. */
export type CanvasSeed = Partial<CanvasSnapshot> & {
  initialMarkdown?: string;
  sourceThreadId?: string;
};

/** Canvases and their shares. Callers check what actions the viewer may take. */
export abstract class CanvasesRepository {
  abstract findMeta(
    scope: CanvasScopeOf,
    canvasId: string
  ): Promise<CanvasMeta | null>;

  abstract findDocument(
    scope: CanvasScopeOf,
    canvasId: string
  ): Promise<StoredCanvasDocument | null>;

  /** The workspace's canvas, including soft-deleted rows so a card can show their status after checking access. */
  abstract findForLink(
    scope: CanvasScopeOf,
    canvasId: string
  ): Promise<StoredCanvasForLink | null>;

  /** The channel's canvases, oldest first. */
  abstract listInChannel(
    scope: CanvasScopeOf,
    roomId: string
  ): Promise<StoredCanvas[]>;

  /** Adds a canvas to the channel. */
  abstract createInChannel(
    scope: CanvasScopeOf,
    roomId: string,
    title: string,
    seed?: CanvasSeed
  ): Promise<string>;

  /** Creates a standalone canvas shared with its creator as an editor. */
  abstract createStandalone(
    scope: CanvasScopeOf,
    title: string,
    seed?: CanvasSeed
  ): Promise<string>;

  /** Readable canvases matching the requested scope, recently updated first. */
  abstract list(
    scope: CanvasScopeOf,
    canvasScope: CanvasScope
  ): Promise<CanvasMeta[]>;

  abstract update(
    scope: CanvasScopeOf,
    canvasId: string,
    patch: CanvasPatch
  ): Promise<void>;

  /**
   * Marks the canvas seeded and returns what to seed it from, or null when someone already claimed it.
   * Atomic, so of any number of callers at once exactly one gets the content.
   */
  abstract claimBootstrap(
    canvasId: string
  ): Promise<Omit<CanvasBootstrap, 'claimed'> | null>;

  /** Writes the snapshot unless its `contentHash` matches the stored one. `saved` says which happened. */
  abstract saveSnapshot(
    scope: CanvasScopeOf,
    canvasId: string,
    snapshot: CanvasSnapshot
  ): Promise<{ saved: boolean; updatedAt: Date }>;

  /** Marks the canvas deleted. */
  abstract softDelete(canvasId: string): Promise<void>;

  /** Current workspace members the canvas is shared with, editors first. */
  abstract listMembers(
    scope: CanvasScopeOf,
    canvasId: string
  ): Promise<CanvasMember[]>;

  /**
   * Shares with each user as `role`, changing the role of anyone already on it.
   * Throws `LAST_EDITOR` when that would leave the canvas with no editor.
   */
  abstract share(
    scope: CanvasScopeOf,
    canvasId: string,
    userIds: string[],
    role: CanvasRole
  ): Promise<void>;

  /** Throws `LAST_EDITOR` when that would leave the canvas with no editor. Does nothing to someone not on it. */
  abstract setMemberRole(
    scope: CanvasScopeOf,
    canvasId: string,
    userId: string,
    role: CanvasRole
  ): Promise<void>;

  /** Throws `LAST_EDITOR` when that would leave the canvas with no editor. */
  abstract removeMember(
    scope: CanvasScopeOf,
    canvasId: string,
    userId: string
  ): Promise<void>;

  /** The workspace's messages with these ids, deleted ones included, whatever room they are in. Callers check access. */
  abstract findMessages(
    organizationId: string,
    messageIds: string[]
  ): Promise<StoredEmbeddedMessage[]>;

  /** Display names by user id. A user who no longer exists has no entry. */
  abstract userNames(userIds: string[]): Promise<Map<string, string>>;

  /** Display names of active members of a workspace, by user id. */
  abstract workspaceUserNames(
    organizationId: string,
    userIds: string[]
  ): Promise<Map<string, string>>;
}
