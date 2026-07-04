import { Module } from '@nestjs/common';
import { BiddingController } from './bidding.controller';
import { BiddingService } from './bidding.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Module providing Smart Bidding functionality for freelancers.
 * Suggests bid prices using market data, job budget, and freelancer experience.
 */
@Module({
  imports: [PrismaModule],
  controllers: [BiddingController],
  providers: [BiddingService],
  exports: [BiddingService],
})
export class BiddingModule {}
