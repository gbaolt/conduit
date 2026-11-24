import { z } from 'zod';

export const CANVAS_TITLE_MAX = 200;
export const CANVAS_MARKDOWN_MAX = 200_000;
/** Characters of the serialized editor state, under the API's 2 MB body limit. */
export const CANVAS_SNAPSHOT_MAX = 1_500_000;
export const CANVAS_SHARE_MAX = 50;

/** What a person a standalone canvas is shared with may do: edit it, or only read it. */
export const CanvasRoleSchema = z.enum(['editor', 'viewer']);
export type CanvasRole = z.infer<typeof CanvasRoleSchema>;

/** What the viewer may do with a canvas, decided by `canvasPolicy`. */
export const CanvasAccessSchema = z.object({
  edit: z.boolean(),
  manageSharing: z.boolean(),
  delete: z.boolean(),
});
export type CanvasAccess = z.infer<typeof CanvasAccessSchema>;

export const CanvasSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  /** The channel it lives in, or null for a standalone canvas. */
  roomId: z.string().nullable(),
  roomName: z.string().nullable(),
  isChannelPrimary: z.boolean(),
  title: z.string(),
  createdById: z.string().nullable(),
  updatedByName: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  access: CanvasAccessSchema,
});
export type Canvas = z.infer<typeof CanvasSchema>;

/** The Lexical editor state, as `editorState.toJSON()` returns it. */
export const CanvasSnapshotSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (snapshot) => JSON.stringify(snapshot).length <= CANVAS_SNAPSHOT_MAX,
    'This canvas is too large to save.'
  );

export const CanvasDocumentSchema = CanvasSchema.extend({
  snapshotJson: z.record(z.string(), z.unknown()).nullable(),
  markdown: z.string(),
});
export type CanvasDocument = z.infer<typeof CanvasDocumentSchema>;

export const CanvasIdInputSchema = z.object({ canvasId: z.string() });

/** `channel` keeps canvases in channels, and `shared` keeps standalone ones shared with the viewer. */
export const CanvasScopeSchema = z.enum(['all', 'channel', 'shared']);
export type CanvasScope = z.infer<typeof CanvasScopeSchema>;

export const ListCanvasesInputSchema = z.object({
  scope: CanvasScopeSchema.default('all'),
});

const CanvasTitleSchema = z.string().trim().max(CANVAS_TITLE_MAX);

/** With a `roomId`, opens that channel's canvas, creating it the first time. */
export const CreateCanvasInputSchema = z.object({
  title: CanvasTitleSchema.optional(),
  roomId: z.string().optional(),
});
export type CreateCanvasInput = z.infer<typeof CreateCanvasInputSchema>;

/** `undefined` leaves a field alone. */
export const UpdateCanvasInputSchema = z.object({
  canvasId: z.string(),
  title: CanvasTitleSchema.optional(),
  snapshotJson: CanvasSnapshotSchema.optional(),
  markdown: z.string().max(CANVAS_MARKDOWN_MAX).optional(),
});
export type UpdateCanvasInput = z.infer<typeof UpdateCanvasInputSchema>;

export const CanvasMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: CanvasRoleSchema,
  addedAt: z.coerce.date(),
});
export type CanvasMember = z.infer<typeof CanvasMemberSchema>;

/** Sharing with someone already on the canvas changes their role. */
export const ShareCanvasInputSchema = z.object({
  canvasId: z.string(),
  userIds: z.array(z.string()).min(1).max(CANVAS_SHARE_MAX),
  role: CanvasRoleSchema,
});
export type ShareCanvasInput = z.infer<typeof ShareCanvasInputSchema>;

export const CanvasMemberInputSchema = z.object({
  canvasId: z.string(),
  userId: z.string(),
});

export const UpdateCanvasMemberRoleInputSchema = CanvasMemberInputSchema.extend(
  { role: CanvasRoleSchema }
);
