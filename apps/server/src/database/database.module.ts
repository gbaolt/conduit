import { Global, Module } from '@nestjs/common';

import { prisma, PrismaService } from './prisma.service';

// Better Auth's config is built at import time with `prisma`, so DI hands out that same client instead of opening a second pool.
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: prisma }],
  exports: [PrismaService],
})
export class DatabaseModule {}
