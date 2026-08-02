import { Module } from '@nestjs/common';
import { AiFeedModule } from '../ai-feed/ai-feed.module';
import { ChapaModule } from '../chapa/chapa.module';
import { ChapaSignatureService } from '../escrow/chapa-signature.service';
import { WalletModule } from '../wallet/wallet.module';
import { CampaignAuctionService } from './campaign-auction.service';
import { CampaignBudgetService } from './campaign-budget.service';
import { CampaignPaymentService } from './campaign-payment.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsScheduler } from './campaigns.scheduler';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [AiFeedModule, WalletModule, ChapaModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignAuctionService,
    CampaignBudgetService,
    CampaignPaymentService,
    CampaignsScheduler,
    ChapaSignatureService,
  ],
  exports: [CampaignsService, CampaignAuctionService, CampaignBudgetService],
})
export class CampaignsModule {}
