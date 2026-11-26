import type {
  CreateCanvasVersionInput,
  RestoreCanvasVersionInput,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { canvasError } from '@/canvases/domain/canvas-errors';
import { CanvasVersionsRepository } from '@/canvases/domain/canvas-versions.repository';

import {
  CanvasesService,
  type CanvasViewerScope,
  contentHashOf,
} from './canvases.service';

/** Version history. Anyone who can view a canvas browses it; whoever can edit saves and restores versions. */
@Injectable()
export class CanvasVersionsService {
  constructor(
    @Inject(CanvasesService) private readonly canvases: CanvasesService,
    @Inject(CanvasVersionsRepository)
    private readonly versions: CanvasVersionsRepository
  ) {}

  private async version(canvasId: string, versionId: string) {
    const version = await this.versions.find(canvasId, versionId);
    if (!version) throw canvasError('VERSION_NOT_FOUND');
    return version;
  }

  async list(
    viewer: CanvasViewerScope,
    input: { canvasId: string; cursor?: string; limit: number }
  ) {
    await this.canvases.load(viewer, input.canvasId, 'view');
    const page = await this.versions.list(input.canvasId, input);
    if (!page) throw canvasError('VERSION_NOT_FOUND');
    return page;
  }

  async get(
    viewer: CanvasViewerScope,
    input: { canvasId: string; versionId: string }
  ) {
    await this.canvases.load(viewer, input.canvasId, 'view');
    return this.version(input.canvasId, input.versionId);
  }

  /** A version saved by hand, whenever the last one was. */
  async create(viewer: CanvasViewerScope, input: CreateCanvasVersionInput) {
    await this.canvases.load(viewer, input.canvasId, 'edit');
    return this.versions.create({
      canvasId: input.canvasId,
      organizationId: viewer.organizationId,
      authorId: viewer.userId,
      label: input.label || null,
      trigger: 'manual',
      snapshotJson: input.snapshotJson,
      markdown: input.markdown,
      contentHash: input.contentHash ?? contentHashOf(input.snapshotJson),
    });
  }

  async restore(viewer: CanvasViewerScope, input: RestoreCanvasVersionInput) {
    await this.canvases.load(viewer, input.canvasId, 'edit');
    const target = await this.version(input.canvasId, input.versionId);
    const current = input.currentSnapshotJson
      ? {
          snapshotJson: input.currentSnapshotJson,
          markdown: input.currentMarkdown ?? '',
          contentHash: contentHashOf(input.currentSnapshotJson),
        }
      : null;
    const versions = await this.versions.restore({
      target,
      organizationId: viewer.organizationId,
      authorId: viewer.userId,
      label: target.label
        ? `Restored from “${target.label}”`
        : 'Restored an earlier version',
      current,
    });
    const canvas = await this.canvases.get(viewer, input.canvasId);
    return { canvas, ...versions };
  }
}
