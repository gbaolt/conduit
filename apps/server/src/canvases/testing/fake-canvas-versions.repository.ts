import type {
  CanvasVersionsRepository,
  LatestCanvasVersion,
  NewCanvasVersion,
  StoredCanvasVersion,
} from '@/canvases/domain/canvas-versions.repository';
import { SAFETY_VERSION_LABEL } from '@/canvases/domain/canvas-versions.repository';

/** Versions in memory. `rows` is every version, oldest first; `restored` every canvas content a restore wrote. */
export class FakeCanvasVersionsRepository implements CanvasVersionsRepository {
  readonly rows: StoredCanvasVersion[] = [];
  readonly restored: { canvasId: string; markdown: string }[] = [];
  private next = 0;

  private newest(canvasId: string) {
    return this.rows
      .filter((row) => row.canvasId === canvasId)
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id)
      );
  }

  async list(canvasId: string, page: { cursor?: string; limit: number }) {
    const all = this.newest(canvasId);
    const start = page.cursor
      ? all.findIndex((row) => row.id === page.cursor) + 1
      : 0;
    if (start === 0 && page.cursor) return null;
    const items = all.slice(start, start + page.limit);
    const more = all.length > start + page.limit;
    return { items, nextCursor: more ? items.at(-1)!.id : null };
  }

  async find(canvasId: string, versionId: string) {
    return (
      this.rows.find(
        (row) => row.id === versionId && row.canvasId === canvasId
      ) ?? null
    );
  }

  /** Adds a version as if saved at `createdAt`, for testing the autosave interval. */
  add(version: NewCanvasVersion, createdAt = new Date()) {
    const row: StoredCanvasVersion = {
      ...version,
      id: `version-${String(++this.next).padStart(4, '0')}`,
      author: version.authorId
        ? { id: version.authorId, name: version.authorId, image: null }
        : null,
      createdAt,
    };
    this.rows.push(row);
    return row;
  }

  async create(version: NewCanvasVersion) {
    return this.add(version);
  }

  async createIfDue(
    version: NewCanvasVersion,
    due: (latest: LatestCanvasVersion | null) => boolean
  ) {
    return due(this.newest(version.canvasId)[0] ?? null)
      ? this.add(version)
      : null;
  }

  async restore({
    target,
    organizationId,
    authorId,
    label,
    current,
  }: Parameters<CanvasVersionsRepository['restore']>[0]) {
    const base = { canvasId: target.canvasId, organizationId, authorId };
    const latest = this.newest(target.canvasId)[0];
    const safetyVersion =
      current && current.contentHash !== latest?.contentHash
        ? this.add({
            ...base,
            ...current,
            label: SAFETY_VERSION_LABEL,
            trigger: 'restore',
          })
        : null;
    this.restored.push({
      canvasId: target.canvasId,
      markdown: target.markdown,
    });
    const restoredVersion = this.add({
      ...base,
      snapshotJson: target.snapshotJson,
      markdown: target.markdown,
      contentHash: target.contentHash,
      label,
      trigger: 'restore',
    });
    return { restoredVersion, safetyVersion };
  }
}
