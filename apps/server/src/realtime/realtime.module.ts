import { Module } from '@nestjs/common';

import { RoomsModule } from '@/rooms/rooms.module';

import { RealtimeService } from './application/realtime.service';
import { LiveQueries } from './domain/live-queries.port';
import { NeonLiveQueries } from './infrastructure/neon-live-queries';
import { RealtimeController } from './presentation/realtime.controller';

@Module({
  imports: [RoomsModule],
  controllers: [RealtimeController],
  providers: [
    RealtimeService,
    { provide: LiveQueries, useClass: NeonLiveQueries },
  ],
})
export class RealtimeModule {}
