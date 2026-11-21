import { Module } from '@nestjs/common';

import { FilesModule } from '@/files/files.module';
import { StorageModule } from '@/storage/storage.module';

import { SearchSyncService } from './application/search-sync.service';
import { FileText } from './domain/file-text.port';
import { SearchIndex } from './domain/search-index.port';
import { SearchSyncRepository } from './domain/search-sync.repository';
import { PrismaSearchSyncRepository } from './infrastructure/prisma-search-sync.repository';
import { StorageFileText } from './infrastructure/storage-file-text';
import { UpstashSearchIndex } from './infrastructure/upstash-search-index';
import { SearchSyncController } from './presentation/search-sync.controller';

@Module({
  imports: [FilesModule, StorageModule],
  controllers: [SearchSyncController],
  providers: [
    SearchSyncService,
    { provide: SearchSyncRepository, useClass: PrismaSearchSyncRepository },
    { provide: SearchIndex, useClass: UpstashSearchIndex },
    { provide: FileText, useClass: StorageFileText },
  ],
  exports: [SearchSyncService, SearchIndex],
})
export class SearchModule {}
