import type {
  CanvasVersion,
  CanvasVersionPage,
  CanvasVersionSummary,
  CanvasVersionTrigger,
} from '@conduit/contract';

/** At most one autosave checkpoint per this long, so steady typing never floods the history. */
export const AUTO_VERSION_INTERVAL_MS = 5 * 60 * 1000;

export const SAFETY_VERSION_LABEL = 'Before restoring version';

export type CanvasVersionContent = {
  snapshotJson: Record<string, unknown>;
  markdown: string;
  contentHash: string;
};

/** A version with its hash, which the contract's output schema drops. */
export type StoredCanvasVersion = CanvasVersion & { contentHash: string };

export type NewCanvasVersion = CanvasVersionContent & {
  canvasId: string;
  organizationId: string;
  authorId: string | null;
  label: string | null;
  trigger: CanvasVersionTrigger;
};

/** What a new checkpoint is weighed against: the canvas's newest version. */
export type LatestCanvasVersion = { contentHash: string; createdAt: Date };

/** An autosave checkpoint is due when the content changed and the last version is old enough. */
export function autoVersionDue(
  latest: LatestCanvasVersion | null,
  contentHash: string,
  now: Date
) {
  if (!latest) return true;
  return (
    latest.contentHash !== contentHash &&
    now.getTime() - latest.createdAt.getTime() >= AUTO_VERSION_INTERVAL_MS
  );
}

/** Versions of canvases. Callers check access first. */
export abstract class CanvasVersionsRepository {
  /** Newest first, ties broken by id. Null when `cursor` is not a version of this canvas. */
  abstract list(
    canvasId: string,
    page: { cursor?: string; limit: number }
  ): Promise<CanvasVersionPage | null>;

  abstract find(
    canvasId: string,
    versionId: string
  ): Promise<StoredCanvasVersion | null>;

  abstract create(version: NewCanvasVersion): Promise<CanvasVersionSummary>;

  /**
   * Records `version` when `due` approves the canvas's newest version, or returns null.
   * Serialized per canvas, so two saves at once never both record.
   */
  abstract createIfDue(
    version: NewCanvasVersion,
    due: (latest: LatestCanvasVersion | null) => boolean
  ): Promise<CanvasVersionSummary | null>;

  /**
   * In one transaction: keeps `current` as a safety version when its hash differs from the newest version's,
   * makes `target`'s content the canvas's, and records that as a `restore` version labelled `label`.
   */
  abstract restore(input: {
    target: StoredCanvasVersion;
    organizationId: string;
    authorId: string;
    label: string;
    current: CanvasVersionContent | null;
  }): Promise<{
    restoredVersion: CanvasVersionSummary;
    safetyVersion: CanvasVersionSummary | null;
  }>;
}
