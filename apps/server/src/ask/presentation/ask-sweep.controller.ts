import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { AskAttachmentsService } from '@/ask/application/ask-attachments.service';
import { bearerMatches } from '@/infrastructure/security/bearer';

/** Called every 15 minutes by the scheduled search sync workflow. It removes Ask attachments no question carries. */
@Controller('internal')
export class AskSweepController {
  constructor(
    @Inject(AskAttachmentsService)
    private readonly attachments: AskAttachmentsService
  ) {}

  @AllowAnonymous()
  @HttpCode(200)
  @Post('ask-sweep')
  async run(@Headers('authorization') authorization?: string) {
    if (!bearerMatches(authorization, process.env.CRON_SECRET)) {
      throw new UnauthorizedException();
    }
    return { removedAttachments: await this.attachments.sweep(new Date()) };
  }
}
