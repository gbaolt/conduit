import { canChannel, type PolicyChannel } from '@/lib/channel-policy';
import type { CanvasRole } from '@/schemas/canvases';
import type { WorkspaceRole } from '@/schemas/organizations';

/** A canvas as the policy sees it: in a channel, or standalone with the viewer's share, if any. */
export type PolicyCanvas = {
  createdById: string | null;
  /** The channel the canvas lives in, or null for a standalone canvas. */
  channel: PolicyChannel | null;
  /** The viewer's share on a standalone canvas. */
  membership: { role: CanvasRole } | null;
};

export type CanvasViewer = { userId: string; workspaceRole: WorkspaceRole };

type Rule = {
  inChannel: (
    viewer: CanvasViewer,
    channel: PolicyChannel,
    canvas: PolicyCanvas
  ) => boolean;
  standalone: (role: CanvasRole | null) => boolean;
};

const canPostIn = (viewer: CanvasViewer, channel: PolicyChannel) =>
  canChannel('post', viewer.workspaceRole, channel);
const isEditor = (role: CanvasRole | null) => role === 'editor';
const isShared = (role: CanvasRole | null) => role !== null;

// A channel canvas follows its channel: whoever can view the channel reads it, whoever can take part edits it,
// and an archived channel leaves it read-only. A standalone canvas opens only for the people it is shared with.
export const canvasPolicy = {
  view: {
    inChannel: (viewer, channel) =>
      canChannel('view', viewer.workspaceRole, channel),
    standalone: isShared,
  },
  edit: { inChannel: canPostIn, standalone: isEditor },
  comment: { inChannel: canPostIn, standalone: isShared },
  // A channel canvas is read by the channel's people, so it has no shares of its own.
  manageSharing: { inChannel: () => false, standalone: isEditor },
  delete: {
    inChannel: (viewer, channel, canvas) =>
      canPostIn(viewer, channel) &&
      (viewer.userId === canvas.createdById ||
        viewer.workspaceRole !== 'member' ||
        channel.membership?.role === 'manager'),
    standalone: isEditor,
  },
} satisfies Record<string, Rule>;

export type CanvasAction = keyof typeof canvasPolicy;

/** `NOT_FOUND` when the viewer cannot read the canvas at all, so a refusal never tells them it exists. */
export type CanvasDenial = 'NOT_FOUND' | 'FORBIDDEN' | 'CHANNEL_ARCHIVED';

function allows(
  action: CanvasAction,
  viewer: CanvasViewer,
  canvas: PolicyCanvas
) {
  const rule: Rule = canvasPolicy[action];
  return canvas.channel
    ? rule.inChannel(viewer, canvas.channel, canvas)
    : rule.standalone(canvas.membership?.role ?? null);
}

export function checkCanvas(
  action: CanvasAction,
  viewer: CanvasViewer,
  canvas: PolicyCanvas
): CanvasDenial | null {
  if (!allows('view', viewer, canvas)) return 'NOT_FOUND';
  if (allows(action, viewer, canvas)) return null;
  return canvas.channel?.archivedAt ? 'CHANNEL_ARCHIVED' : 'FORBIDDEN';
}

export function canCanvas(
  action: CanvasAction,
  viewer: CanvasViewer,
  canvas: PolicyCanvas
) {
  return checkCanvas(action, viewer, canvas) === null;
}
