export type LiveblocksPermission =
  | 'room:read'
  | 'room:presence:write'
  | 'room:write';

/** What other people in the room see of this user: their name, avatar, and cursor color. */
export type LiveblocksUserInfo = {
  name: string;
  image: string | null;
  color: string;
};

/** The one Liveblocks room that holds a canvas's live document and cursors. */
export function liveblocksRoomId(organizationId: string, canvasId: string) {
  return `canvas:${organizationId}:${canvasId}`;
}

// Each takes white text at 4.5:1 or more and stays visible on a dark page, ordered so neighbours differ in hue.
const CURSOR_COLORS = [
  '#2563eb',
  '#c2410c',
  '#7c3aed',
  '#15803d',
  '#be185d',
  '#0369a1',
  '#a16207',
  '#dc2626',
  '#0f766e',
  '#9333ea',
];

/** The same color for a user on every canvas and every device. */
export function cursorColorOf(userId: string) {
  // FNV-1a, so similar ids still spread across the palette.
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash = Math.imul(hash ^ userId.charCodeAt(i), 0x01000193);
  }
  return CURSOR_COLORS[(hash >>> 0) % CURSOR_COLORS.length]!;
}

/** Liveblocks rooms. Postgres decides access before any call here; this port only mints and removes. */
export abstract class LiveblocksPort {
  /** False when no `LIVEBLOCKS_SECRET_KEY` is set, so canvases fall back to single-user saves. */
  abstract readonly enabled: boolean;

  /** A token that opens `roomId` alone, with `permissions`. */
  abstract authorize(
    userId: string,
    userInfo: LiveblocksUserInfo,
    roomId: string,
    permissions: LiveblocksPermission[]
  ): Promise<string>;

  /** A room that does not exist, or no Liveblocks key, is not an error. */
  abstract deleteRoom(roomId: string): Promise<void>;
}
