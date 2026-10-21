import { contract } from '@conduit/contract';
import { Controller, Inject } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';

import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService
  ) {}

  @AllowAnonymous()
  @Implement(contract.users.getSession)
  getSession() {
    return implement(contract.users.getSession)
      .$context<{ request: Request }>()
      .handler(async ({ context }) => {
        return this.usersService.getSession(context.request);
      });
  }
}
