import { Inject, Injectable } from '@nestjs/common';

import { sectionError } from '@/channels/domain/channel-errors';
import {
  ChannelSectionsRepository,
  type SectionScope,
} from '@/channels/domain/channel-sections.repository';

export type SectionViewer = SectionScope;

/** Every method is scoped to the viewer's own sections in the active workspace. */
@Injectable()
export class ChannelSectionsService {
  constructor(
    @Inject(ChannelSectionsRepository)
    private readonly sections: ChannelSectionsRepository
  ) {}

  list(viewer: SectionViewer) {
    return this.sections.list(viewer);
  }

  create(viewer: SectionViewer, name: string) {
    return this.sections.create(viewer, name);
  }

  async rename(viewer: SectionViewer, sectionId: string, name: string) {
    await this.own(viewer, sectionId);
    return this.sections.rename(sectionId, name);
  }

  async delete(viewer: SectionViewer, sectionId: string) {
    await this.own(viewer, sectionId);
    await this.sections.delete(sectionId);
  }

  async reorder(viewer: SectionViewer, sectionIds: string[]) {
    const ids = [...new Set(sectionIds)];
    if ((await this.sections.count(viewer, ids)) !== ids.length) {
      throw sectionError('NOT_FOUND');
    }
    await this.sections.reorder(ids);
  }

  private async own(viewer: SectionViewer, sectionId: string) {
    if (!(await this.sections.exists(viewer, sectionId))) {
      throw sectionError('NOT_FOUND');
    }
  }
}
