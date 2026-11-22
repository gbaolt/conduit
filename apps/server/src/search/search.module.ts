import { Module } from '@nestjs/common';

import { FilesModule } from '@/files/files.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { RoomsModule } from '@/rooms/rooms.module';
import { StorageModule } from '@/storage/storage.module';

import { SearchService } from './application/search.service';
import { SearchSyncService } from './application/search-sync.service';
import { FileText } from './domain/file-text.port';
import { SearchRepository } from './domain/search.repository';
import { SearchIndex } from './domain/search-index.port';
import { SearchSyncRepository } from './domain/search-sync.repository';
import { PrismaSearchRepository } from './infrastructure/prisma-search.repository';
import { PrismaSearchSyncRepository } from './infrastructure/prisma-search-sync.repository';
import { StorageFileText } from './infrastructure/storage-file-text';
import { UpstashSearchIndex } from './infrastructure/upstash-search-index';
import { SearchController } from './presentation/search.controller';
import { SearchSyncController } from './presentation/search-sync.controller';

@Module({
  imports: [FilesModule, StorageModule, RoomsModule, NotificationsModule],
  controllers: [SearchController, SearchSyncController],
  providers: [
    SearchService,
    SearchSyncService,
    { provide: SearchRepository, useClass: PrismaSearchRepository },
    { provide: SearchSyncRepository, useClass: PrismaSearchSyncRepository },
    { provide: SearchIndex, useClass: UpstashSearchIndex },
    { provide: FileText, useClass: StorageFileText },
  ],
  exports: [SearchService, SearchSyncService, SearchIndex, FileText],
})
export class SearchModule {}
