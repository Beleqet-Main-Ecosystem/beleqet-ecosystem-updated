import { Module } from '@nestjs/common';
import { DisputeManagerService } from './dispute-manager.service';
import { DisputeManagerController } from './dispute-manager.controller';

/**
 * Module responsible for handling disputes between platform users.
 */
@Module({
  controllers: [DisputeManagerController],
  providers: [DisputeManagerService],
  exports: [DisputeManagerService],
})
export class DisputeManagerModule {}
