import type {
  LiveblocksPermission,
  LiveblocksPort,
  LiveblocksUserInfo,
} from '@/canvases/domain/liveblocks.port';

/** Liveblocks in memory. `grants` records every token it minted, and `deletedRooms` every room it removed. */
export class FakeLiveblocksGateway implements LiveblocksPort {
  readonly grants: {
    userId: string;
    userInfo: LiveblocksUserInfo;
    roomId: string;
    permissions: LiveblocksPermission[];
  }[] = [];
  readonly deletedRooms: string[] = [];

  constructor(readonly enabled = true) {}

  authorize(
    userId: string,
    userInfo: LiveblocksUserInfo,
    roomId: string,
    permissions: LiveblocksPermission[]
  ) {
    this.grants.push({ userId, userInfo, roomId, permissions });
    return Promise.resolve(`token-${this.grants.length}`);
  }

  deleteRoom(roomId: string) {
    this.deletedRooms.push(roomId);
    return Promise.resolve();
  }
}
