import { z } from 'zod';

import { MessageBodySchema } from '@/lib/message-body';
import { MessageHitSchema } from '@/schemas/search';

export const CANVAS_TITLE_MAX = 200;
export const CANVAS_MARKDOWN_MAX = 200_000;
/** Characters of the serialized editor state, under the API's 2 MB body limit. */
export const CANVAS_SNAPSHOT_MAX = 1_500_000;
export const CANVAS_SHARE_MAX = 50;
export const CANVAS_QUOTE_MAX = 1000;
export const CANVAS_EMBEDS_MAX = 50;

/** What a person a standalone canvas is shared with may do: edit it, or only read it. */
export const CanvasRoleSchema = z.enum(['editor', 'viewer']);
export type CanvasRole = z.infer<typeof CanvasRoleSchema>;

/** What the viewer may do with a canvas, decided by `canvasPolicy`. */
export const CanvasAccessSchema = z.object({
  edit: z.boolean(),
  comment: z.boolean(),
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

/** A Liveblocks token for the canvas's room alone, or `enabled: false` when the server has no Liveblocks key. */
export const CanvasLiveblocksAuthSchema = z.discriminatedUnion('enabled', [
  z.object({
    enabled: z.literal(true),
    token: z.string(),
    roomId: z.string(),
    /** The viewer's cursor color, the same on every canvas. */
    color: z.string(),
  }),
  z.object({ enabled: z.literal(false) }),
]);
export type CanvasLiveblocksAuth = z.infer<typeof CanvasLiveblocksAuthSchema>;

/** `claimed` is true for the one caller who seeds the empty live document, with what to seed it from. */
export const CanvasBootstrapSchema = z.object({
  claimed: z.boolean(),
  /** The saved editor state, serialized. Wins over `initialMarkdown`. */
  snapshotJson: z.string().nullable(),
  initialMarkdown: z.string().nullable(),
});
export type CanvasBootstrap = z.infer<typeof CanvasBootstrapSchema>;

export const SaveCanvasSnapshotInputSchema = z.object({
  canvasId: z.string(),
  snapshotJson: CanvasSnapshotSchema,
  markdown: z.string().max(CANVAS_MARKDOWN_MAX),
  /** SHA-256 of `snapshotJson` as hex. A save that matches the stored hash writes nothing. */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type SaveCanvasSnapshotInput = z.infer<
  typeof SaveCanvasSnapshotInputSchema
>;

export const CanvasSnapshotSavedSchema = z.object({
  saved: z.boolean(),
  updatedAt: z.coerce.date(),
});

export const CanvasCommentAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});

export const CanvasCommentSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  author: CanvasCommentAuthorSchema,
  /** Markdown, as in a message. A mention is `<@userId>`. */
  body: z.string(),
  editedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type CanvasComment = z.infer<typeof CanvasCommentSchema>;

/** Comments on one passage, oldest first. The passage is a mark in the document carrying the thread's id. */
export const CanvasCommentThreadSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  /** The passage as it read when the thread started, kept after it is edited or deleted. */
  quote: z.string(),
  resolvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  comments: z.array(CanvasCommentSchema),
});
export type CanvasCommentThread = z.infer<typeof CanvasCommentThreadSchema>;

export const CreateCanvasCommentThreadInputSchema = z.object({
  canvasId: z.string(),
  quote: z.string().trim().min(1).max(CANVAS_QUOTE_MAX),
  body: MessageBodySchema,
});

export const ReplyCanvasCommentInputSchema = z.object({
  canvasId: z.string(),
  threadId: z.string(),
  body: MessageBodySchema,
});

export const CanvasCommentInputSchema = z.object({
  canvasId: z.string(),
  commentId: z.string(),
});

export const EditCanvasCommentInputSchema = CanvasCommentInputSchema.extend({
  body: MessageBodySchema,
});

export const ResolveCanvasCommentThreadInputSchema = z.object({
  canvasId: z.string(),
  threadId: z.string(),
  resolved: z.boolean(),
});

export const EmbeddedMessagesInputSchema = z.object({
  canvasId: z.string(),
  messageIds: z.array(z.string()).min(1).max(CANVAS_EMBEDS_MAX),
});

/** A message embedded in a canvas. Only `ok` carries any of it, so a viewer outside its room learns nothing. */
export const EmbeddedMessageSchema = z.discriminatedUnion('status', [
  z.object({
    messageId: z.string(),
    status: z.literal('ok'),
    message: MessageHitSchema,
  }),
  z.object({ messageId: z.string(), status: z.literal('inaccessible') }),
  z.object({ messageId: z.string(), status: z.literal('deleted') }),
]);
export type EmbeddedMessage = z.infer<typeof EmbeddedMessageSchema>;
