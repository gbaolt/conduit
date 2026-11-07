import { Module } from '@nestjs/common';

import { ChannelsModule } from '@/channels/channels.module';

import { MessagesService } from './application/messages.service';
import { MessagesRepository } from './domain/messages.repository';
import { PrismaMessagesRepository } from './infrastructure/prisma-messages.repository';
import { MessagesController } from './presentation/messages.controller';

@Module({
  imports: [ChannelsModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    { provide: MessagesRepository, useClass: PrismaMessagesRepository },
  ],
})
export class MessagesModule {}
