import { Liveblocks, LiveblocksError } from '@liveblocks/node';
import { Injectable } from '@nestjs/common';

import type {
  LiveblocksPermission,
  LiveblocksPort,
  LiveblocksUserInfo,
} from '@/canvases/domain/liveblocks.port';

@Injectable()
export class LiveblocksGateway implements LiveblocksPort {
  private readonly client = process.env.LIVEBLOCKS_SECRET_KEY
    ? new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY })
    : null;

  get enabled() {
    return this.client !== null;
  }

  async authorize(
    userId: string,
    userInfo: LiveblocksUserInfo,
    roomId: string,
    permissions: LiveblocksPermission[]
  ) {
    if (!this.client) throw new Error('Liveblocks is not configured.');
    const session = this.client.prepareSession(userId, { userInfo });
    session.allow(roomId, permissions);
    const { status, body } = await session.authorize();
    if (status !== 200) throw new Error(`Liveblocks refused a token: ${body}`);
    return (JSON.parse(body) as { token: string }).token;
  }

  async deleteRoom(roomId: string) {
    if (!this.client) return;
    try {
      await this.client.deleteRoom(roomId);
    } catch (error) {
      if (error instanceof LiveblocksError && error.status === 404) return;
      throw error;
    }
  }
}
