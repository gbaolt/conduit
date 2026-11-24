import {
  type CanvasDraftEvent,
  type ModelCanvasDraft,
  ModelCanvasDraftSchema,
} from '@conduit/contract';
import { Inject, Injectable } from '@nestjs/common';

import { AiAccessService } from '@/ai/application/ai-access.service';
import { aiError } from '@/ai/domain/ai-errors';
import { ModelPort, type PartialObject } from '@/ai/domain/model.port';
import {
  assembleCanvasDraft,
  buildCanvasDraftInput,
  CANVAS_DRAFT_MAX_OUTPUT_TOKENS,
  CANVAS_DRAFT_SYSTEM_PROMPT,
  type CanvasDraftInput,
  type ThreadLink,
} from '@/canvases/domain/canvas-draft-prompt';
import { canvasError } from '@/canvases/domain/canvas-errors';
import { CanvasesRepository } from '@/canvases/domain/canvases.repository';
import {
  MessagesService,
  type MessageViewer,
} from '@/messages/application/messages.service';

/** Drafts a canvas from a thread. It writes nothing: the draft is saved only when its requester creates the canvas. */
@Injectable()
export class CanvasDraftService {
  constructor(
    @Inject(AiAccessService) private readonly access: AiAccessService,
    @Inject(ModelPort) private readonly model: ModelPort,
    @Inject(MessagesService) private readonly messages: MessagesService,
    @Inject(CanvasesRepository) private readonly canvases: CanvasesRepository
  ) {}

  /**
   * Everything that can refuse happens here, before the stream starts, so a refusal is an ordinary error and not
   * a broken stream. A thread in a room the viewer cannot read is `NOT_FOUND`.
   */
  async draftFromThread(
    viewer: MessageViewer,
    messageId: string,
    signal?: AbortSignal
  ) {
    await this.access.assertEnabled(viewer.organizationId);
    const root = await this.messages.get(viewer, messageId);
    if (root.parentId) throw canvasError('NOT_FOUND');
    const room = await this.messages.find(viewer, root.roomId);

    const messages = await this.messages.listForSummary(viewer, {
      roomId: root.roomId,
      threadId: root.id,
    });
    const names = await this.canvases.userNames([
      ...new Set(
        messages.flatMap((message) => [
          message.authorId,
          ...message.mentionedUserIds,
        ])
      ),
    ]);
    const input = buildCanvasDraftInput(messages, names);
    if (input.messageCount === 0) throw canvasError('NOTHING_TO_DRAFT');

    const link = { roomId: room.id, rootId: root.id, isDm: room.kind === 'dm' };
    return this.stream(input, link, signal);
  }

  private async *stream(
    input: CanvasDraftInput,
    link: ThreadLink,
    signal?: AbortSignal
  ): AsyncGenerator<CanvasDraftEvent> {
    let last: PartialObject<ModelCanvasDraft> | undefined;
    let shown = '';

    for await (const partial of this.model.streamObject({
      system: CANVAS_DRAFT_SYSTEM_PROMPT,
      prompt: input.prompt,
      schema: ModelCanvasDraftSchema,
      maxOutputTokens: CANVAS_DRAFT_MAX_OUTPUT_TOKENS,
      signal,
    })) {
      last = partial;
      const { title, markdown } = assembleCanvasDraft(
        partial,
        input.sources,
        link,
        { writing: true }
      );
      const key = `${title}\n${markdown}`;
      if (key !== shown) {
        shown = key;
        yield {
          type: 'partial',
          messageCount: input.messageCount,
          title,
          markdown,
        };
      }
    }

    const draft = assembleCanvasDraft(last, input.sources, link);
    if (draft.sourceMessageIds.length === 0) throw aiError('AI_UNAVAILABLE');
    yield {
      type: 'done',
      draft: {
        title: draft.title || 'Thread draft',
        markdown: draft.markdown,
        sourceThreadId: link.rootId,
        sourceMessageIds: draft.sourceMessageIds,
      },
    };
  }
}
