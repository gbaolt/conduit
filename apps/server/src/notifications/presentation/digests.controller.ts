import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { bearerMatches } from '@/infrastructure/security/bearer';
import { DigestsService } from '@/notifications/application/digests.service';

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
