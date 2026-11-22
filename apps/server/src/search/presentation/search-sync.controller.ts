import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { FilesService } from '@/files/application/files.service';
import { bearerMatches } from '@/infrastructure/security/bearer';
import {
  DRAIN_LIMIT,
  SearchSyncService,
} from '@/search/application/search-sync.service';

/** Under the function's 300 s limit, so a backlog spreads across runs and the file sweep still runs. */
const SWEEP_BUDGET_MS = 240 * 1000;

/** Called every 15 minutes by the scheduled GitHub workflow. It retries failed rows and removes abandoned files. */
@Controller('internal')
export class SearchSyncController {
  constructor(
    @Inject(SearchSyncService) private readonly searchSync: SearchSyncService,
    @Inject(FilesService) private readonly files: FilesService
  ) {}

  @AllowAnonymous()
  @HttpCode(200)
  @Post('search-sync')
  async run(@Headers('authorization') authorization?: string) {
    if (!bearerMatches(authorization, process.env.CRON_SECRET)) {
      throw new UnauthorizedException();
    }

    const until = Date.now() + SWEEP_BUDGET_MS;
    let synced = 0;
    while (Date.now() < until) {
      const drained = await this.searchSync.drain({ until });
      synced += drained.synced;
      if (drained.claimed < DRAIN_LIMIT) break;
    }
    return { synced, removedFiles: await this.files.sweep(new Date()) };
  }
}
