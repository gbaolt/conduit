import { timingSafeEqual } from 'node:crypto';

import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { DigestsService } from '@/notifications/application/digests.service';

/** Whether `header` is `Bearer <secret>`. The compare takes the same time wherever the two differ. */
function bearerMatches(header: string | undefined, secret: string | undefined) {
  if (!secret || !header?.startsWith('Bearer ')) return false;

  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Called by the scheduled GitHub workflow, not by a signed-in member, so Better Auth's guard and oRPC stay out of it. */
@Controller('internal')
export class DigestsController {
  constructor(
    @Inject(DigestsService) private readonly digests: DigestsService
  ) {}

  @AllowAnonymous()
  @HttpCode(200)
  @Post('digests')
  async run(@Headers('authorization') authorization?: string) {
    if (!bearerMatches(authorization, process.env.CRON_SECRET)) {
      throw new UnauthorizedException();
    }

    return { sent: await this.digests.sendDigests(new Date()) };
  }
}
