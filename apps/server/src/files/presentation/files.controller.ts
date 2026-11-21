import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import {
  FilesService,
  type FileViewer,
} from '@/files/application/files.service';
import { authorized } from '@/infrastructure/orpc/authorized';
import { workspaceMember } from '@/infrastructure/orpc/workspace-member';
import { arcjet } from '@/infrastructure/security/procedure.middleware';

function viewerOf(context: {
  user: { id: string };
  organizationId: string;
  workspaceRole: FileViewer['workspaceRole'];
}): FileViewer {
  return {
    userId: context.user.id,
    organizationId: context.organizationId,
    workspaceRole: context.workspaceRole,
  };
}

@Controller()
export class FilesController {
  constructor(
    @Inject(FilesService) private readonly filesService: FilesService
  ) {}

  @Implement(contract.files.uploadUrl)
  uploadUrl() {
    return implement(contract.files.uploadUrl)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.filesService.uploadUrl(viewerOf(context), input)
      );
  }

  @Implement(contract.files.complete)
  complete() {
    return implement(contract.files.complete)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.filesService.complete(viewerOf(context), input)
      );
  }

  @Implement(contract.files.cancel)
  cancel() {
    return implement(contract.files.cancel)
      .use(authorized)
      .use(arcjet.write)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.filesService.cancel(viewerOf(context), input.fileId)
      );
  }

  @Implement(contract.files.urls)
  urls() {
    return implement(contract.files.urls)
      .use(authorized)
      .use(arcjet.read)
      .use(workspaceMember)
      .handler(({ context, input }) =>
        this.filesService.urls(viewerOf(context), input.fileIds)
      );
  }
}
