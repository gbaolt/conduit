import { Module } from '@nestjs/common';

import { DmsModule } from '@/dms/dms.module';
import { RoomsModule } from '@/rooms/rooms.module';

import { LinkPreviewsService } from './application/link-previews.service';
import { MessagesService } from './application/messages.service';
import { LinkPreviewFetcher } from './domain/link-preview.fetcher';
import { MessagesRepository } from './domain/messages.repository';
import { SavedMessagesRepository } from './domain/saved-messages.repository';
import { HttpLinkPreviewFetcher } from './infrastructure/link-preview.fetcher';
import { PrismaMessagesRepository } from './infrastructure/prisma-messages.repository';
import { PrismaSavedMessagesRepository } from './infrastructure/prisma-saved-messages.repository';
import { MessagesController } from './presentation/messages.controller';

@Module({
  imports: [RoomsModule, DmsModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    LinkPreviewsService,
    {
      provide: LinkPreviewFetcher,
      useFactory: () => new HttpLinkPreviewFetcher(),
    },
    { provide: MessagesRepository, useClass: PrismaMessagesRepository },
    {
      provide: SavedMessagesRepository,
      useClass: PrismaSavedMessagesRepository,
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
