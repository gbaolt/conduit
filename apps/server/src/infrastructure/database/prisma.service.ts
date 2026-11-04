import { PrismaClient } from '@generated/prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import type { OnModuleInit } from '@nestjs/common';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

import { isWorker } from '@/infrastructure/runtime';

// The Worker uses its native WebSocket; Node keeps the ws package.
neonConfig.webSocketConstructor = isWorker ? WebSocket : ws;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('Missing DATABASE_URL (Neon connection string)');
    }

    // A Worker cannot reuse a socket opened by an earlier request, so each connection serves one checkout.
    super({
      adapter: new PrismaNeon({
        connectionString,
        ...(isWorker && { maxUses: 1 }),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export const prisma = new PrismaService();
