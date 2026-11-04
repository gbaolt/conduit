import { contract } from '@conduit/contract';
import { Controller, Get, Res } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';

@Controller()
export class HealthController {
  @AllowAnonymous()
  @Get()
  root(@Res() res: Response) {
    res.type('html').send('<h1>Welcome to Conduit API</h1>');
  }

  @AllowAnonymous()
  @Implement(contract.health.check)
  check() {
    return implement(contract.health.check).handler(() => ({
      status: 'ok' as const,
    }));
  }
}
