import { Module } from '@nestjs/common';
import { SmartBiddingController } from './smart-bidding.controller';
import { SmartBiddingService } from './smart-bidding.service';

@Module({
  controllers: [SmartBiddingController],
  providers: [SmartBiddingService],
  exports: [SmartBiddingService],
})
export class SmartBiddingModule {}
