import { createRealtime, pgParam, rawSql } from '@neon/realtime/server';
import { Injectable } from '@nestjs/common';

import type {
  LiveQueries,
  LiveQuery,
} from '@/realtime/domain/live-queries.port';
import { realtimeError } from '@/realtime/domain/realtime-errors';

/** The database name in `DATABASE_URL`, which Realtime binds each capability to. */
function databaseName() {
  const name = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  return decodeURIComponent(name);
}

/** Reads its settings on each call, so a server without Realtime still boots and serves everything else. */
@Injectable()
export class NeonLiveQueries implements LiveQueries {
  async seal(query: LiveQuery) {
    const url = process.env.NEON_REALTIME_URL;
    const secret = process.env.NEON_REALTIME_SECRET;
    if (!url || !secret) {
      throw realtimeError('REALTIME_UNAVAILABLE');
    }

    const sealed = await createRealtime({ secret, db: databaseName() }).seal({
      query: rawSql(
        query.sql,
        query.parameters.map((parameter) =>
          parameter instanceof Date ? pgParam.timestamp(parameter) : parameter
        )
      ),
    });

    return {
      capability: sealed.capability,
      queryFingerprint: sealed.queryFingerprint,
      expiresAt: sealed.expiresAt,
      url,
    };
  }
}
