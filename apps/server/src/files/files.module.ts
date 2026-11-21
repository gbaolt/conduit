import { Module } from '@nestjs/common';

import { RoomsModule } from '@/rooms/rooms.module';
import { StorageModule } from '@/storage/storage.module';

import { FilesService } from './application/files.service';
import { FilesRepository } from './domain/files.repository';
import { PrismaFilesRepository } from './infrastructure/prisma-files.repository';
import { FilesController } from './presentation/files.controller';

@Module({
  imports: [RoomsModule, StorageModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    { provide: FilesRepository, useClass: PrismaFilesRepository },
  ],
  exports: [FilesService, FilesRepository],
})
export class FilesModule {}
