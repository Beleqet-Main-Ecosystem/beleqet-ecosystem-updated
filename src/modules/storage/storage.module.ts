import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

/**
 * Module bundling all files and controllers for the secure Storage capability.
 */
@Module({
  providers: [StorageService],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
