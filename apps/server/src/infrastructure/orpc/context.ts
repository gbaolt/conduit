import type { ArcjetNest } from '@arcjet/nest';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

export type ORPCContext = {
  request: Request;
  arcjet: ArcjetNest;
  workspaceMembers: WorkspaceMembersRepository;
};

/* eslint-disable @typescript-eslint/no-empty-object-type -- module augmentation can only merge through `extends`. */
declare module '@orpc/server' {
  interface DefaultInitialContext extends ORPCContext {}
}

declare module '@orpc/nest' {
  interface ORPCGlobalContext extends ORPCContext {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export function createORPCContext(
  executionContext: object,
  dependencies: Omit<ORPCContext, 'request'>
): ORPCContext {
  return {
    request: (executionContext as ExecutionContext)
      .switchToHttp()
      .getRequest<Request>(),
    ...dependencies,
  };
}
