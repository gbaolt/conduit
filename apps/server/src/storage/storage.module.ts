import { Module } from '@nestjs/common';

import { ObjectStorage } from './domain/object-storage';
import { S3ObjectStorage } from './infrastructure/s3-object-storage';

@Module({
  providers: [{ provide: ObjectStorage, useClass: S3ObjectStorage }],
  exports: [ObjectStorage],
})
export class StorageModule {}
