import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { CanvasCommentsService } from '@/canvases/application/canvas-comments.service';
import { CanvasDraftService } from '@/canvases/application/canvas-draft.service';
import { CanvasVersionsService } from '@/canvases/application/canvas-versions.service';
import {
  CanvasesService,
  type CanvasViewerScope,
} from '@/canvases/application/canvases.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { translateStreamErrors } from '@/infrastructure/orpc/errors';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: CanvasViewerScope['workspaceRole'];
}): CanvasViewerScope {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

@Controller()
export class CanvasesController {
  constructor(
    @Inject(CanvasesService) private readonly canvasesService: CanvasesService,
    @Inject(CanvasCommentsService)
    private readonly commentsService: CanvasCommentsService,
    @Inject(CanvasVersionsService)
    private readonly versionsService: CanvasVersionsService,
    @Inject(CanvasDraftService)
    private readonly draftService: CanvasDraftService
  ) {}

  @Implement(contract.canvases.getChannelCanvas)
  getChannelCanvas() {
    return implement(contract.canvases.getChannelCanvas)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.getChannelCanvas(viewerOf(context), input.roomId)
      );
  }

  @Implement(contract.canvases.list)
  list() {
    return implement(contract.canvases.list)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.list(viewerOf(context), input.scope)
      );
  }

  @Implement(contract.canvases.get)
  get() {
    return implement(contract.canvases.get)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.get(viewerOf(context), input.canvasId)
      );
  }

  @Implement(contract.canvases.create)
  create() {
    return implement(contract.canvases.create)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.create(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.update)
  update() {
    return implement(contract.canvases.update)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.update(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.delete)
  remove() {
    return implement(contract.canvases.delete)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.delete(viewerOf(context), input.canvasId)
      );
  }

  @Implement(contract.canvases.listMembers)
  listMembers() {
    return implement(contract.canvases.listMembers)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.listMembers(viewerOf(context), input.canvasId)
      );
  }

  @Implement(contract.canvases.share)
  share() {
    return implement(contract.canvases.share)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.share(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.updateMemberRole)
  updateMemberRole() {
    return implement(contract.canvases.updateMemberRole)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.updateMemberRole(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.removeMember)
  removeMember() {
    return implement(contract.canvases.removeMember)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.removeMember(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.liveblocksAuth)
  liveblocksAuth() {
    return implement(contract.canvases.liveblocksAuth)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.liveblocksAuth(
          viewerOf(context),
          input.canvasId,
          context.user
        )
      );
  }

  @Implement(contract.canvases.claimBootstrap)
  claimBootstrap() {
    return implement(contract.canvases.claimBootstrap)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.claimBootstrap(viewerOf(context), input.canvasId)
      );
  }

  @Implement(contract.canvases.saveSnapshot)
  saveSnapshot() {
    return implement(contract.canvases.saveSnapshot)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.saveSnapshot(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.listComments)
  listComments() {
    return implement(contract.canvases.listComments)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.commentsService.list(viewerOf(context), input.canvasId)
      );
  }

  @Implement(contract.canvases.createCommentThread)
  createCommentThread() {
    return implement(contract.canvases.createCommentThread)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.commentsService.createThread(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.replyComment)
  replyComment() {
    return implement(contract.canvases.replyComment)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.commentsService.reply(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.editComment)
  editComment() {
    return implement(contract.canvases.editComment)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.commentsService.edit(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.deleteComment)
  deleteComment() {
    return implement(contract.canvases.deleteComment)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.commentsService.delete(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.resolveCommentThread)
  resolveCommentThread() {
    return implement(contract.canvases.resolveCommentThread)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.commentsService.resolve(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.embeddedMessages)
  embeddedMessages() {
    return implement(contract.canvases.embeddedMessages)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.canvasesService.embeddedMessages(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.listVersions)
  listVersions() {
    return implement(contract.canvases.listVersions)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.versionsService.list(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.getVersion)
  getVersion() {
    return implement(contract.canvases.getVersion)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.versionsService.get(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.createVersion)
  createVersion() {
    return implement(contract.canvases.createVersion)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.versionsService.create(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.restoreVersion)
  restoreVersion() {
    return implement(contract.canvases.restoreVersion)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.versionsService.restore(viewerOf(context), input)
      );
  }

  @Implement(contract.canvases.draftFromThread)
  draftFromThread() {
    return implement(contract.canvases.draftFromThread)
      .use(authorized)
      .use(workspaceMember)
      .use(arcjet.heavyWriteByWorkspace)
      .handler(async ({ context, input, signal }) =>
        translateStreamErrors(
          await this.draftService.draftFromThread(
            viewerOf(context),
            input.messageId,
            signal
          )
        )
      );
  }
}
