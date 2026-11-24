import type {
  Canvas,
  CanvasDocument,
  CanvasMember,
  CanvasRole,
  CanvasScope,
} from '@conduit/contract';

/** A canvas row as the app sees it, before the viewer's `access` is worked out. */
export type StoredCanvas = Omit<Canvas, 'access'> & {
  /** The viewer's share on a standalone canvas. */
  viewerRole: CanvasRole | null;
};

export type StoredCanvasDocument = StoredCanvas &
  Pick<CanvasDocument, 'snapshotJson' | 'markdown'>;

/** Whose view of a canvas to load: `viewerRole` depends on it. */
export type CanvasScopeOf = { userId: string; organizationId: string };

export type CanvasPatch = {
  title?: string;
  snapshotJson?: Record<string, unknown>;
  markdown?: string;
};

/** Canvases and their shares. Callers check access first; this port knows only rows. Deleted canvases are never returned. */
export abstract class CanvasesRepository {
  abstract find(
    scope: CanvasScopeOf,
    canvasId: string
  ): Promise<StoredCanvasDocument | null>;

  abstract findChannelPrimary(
    scope: CanvasScopeOf,
    roomId: string
  ): Promise<StoredCanvasDocument | null>;

  /** Creates the channel's primary canvas, or returns the id of the one someone else created first. */
  abstract createChannelPrimary(
    scope: CanvasScopeOf,
    roomId: string,
    title: string
  ): Promise<string>;

  /** Creates a standalone canvas shared with its creator as an editor. */
  abstract createStandalone(
    scope: CanvasScopeOf,
    title: string
  ): Promise<string>;

  /** Canvases in `roomIds` and standalone canvases shared with the scope's user, recently updated first. */
  abstract list(
    scope: CanvasScopeOf,
    roomIds: string[],
    canvasScope: CanvasScope
  ): Promise<StoredCanvas[]>;

  abstract update(
    scope: CanvasScopeOf,
    canvasId: string,
    patch: CanvasPatch
  ): Promise<void>;

  /** Marks the canvas deleted, which also frees its channel for a new primary canvas. */
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
}
