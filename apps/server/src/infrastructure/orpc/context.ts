import type { ArcjetNest } from '@arcjet/nest';
import type { ExecutionContext } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

import type { WorkspaceMembersRepository } from '@/workspaces/domain/workspace-members.repository';

export type ORPCContext = {
  request: Request;
  /** The request's headers as web `Headers`, the form Better Auth's API takes. */
  headers: Headers;
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
  dependencies: Omit<ORPCContext, 'request' | 'headers'>
): ORPCContext {
  const request = (executionContext as ExecutionContext)
    .switchToHttp()
    .getRequest<Request>();
  return {
    request,
    headers: fromNodeHeaders(request.headers),
    ...dependencies,
  };
}
