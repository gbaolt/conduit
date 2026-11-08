import {
  checkChannel,
  type LiveStream,
  type WorkspaceRole,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { ChannelsRepository } from '@/channels/domain/channels.repository';
import { LiveQueries } from '@/realtime/domain/live-queries.port';
import { realtimeError } from '@/realtime/domain/realtime-errors';

import { queryFor } from './live-streams';

export type RealtimeViewer = {
  userId: string;
  organizationId: string;
  workspaceRole: WorkspaceRole;
};

@Injectable()
export class RealtimeService {
  constructor(
    @Inject(LiveQueries) private readonly liveQueries: LiveQueries,
    @Inject(ChannelsRepository) private readonly channels: ChannelsRepository
  ) {}

  /**
   * Checks the viewer's access now. A sealed query lives 60 s and the client renews it through here,
   * so someone who loses access stops receiving changes within a minute.
   */
  async seal(viewer: RealtimeViewer, stream: LiveStream) {
    if ('roomId' in stream) {
      const channel = await this.channels.find(viewer, stream.roomId);
      if (!channel || checkChannel('view', viewer.workspaceRole, channel)) {
        throw realtimeError('NOT_FOUND');
      }
    }
    return this.liveQueries.seal(queryFor(stream, viewer));
  }
}
