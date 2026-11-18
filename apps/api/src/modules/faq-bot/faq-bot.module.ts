import { Module } from '@nestjs/common';
import { FaqBotController } from './faq-bot.controller';
import { FaqBotService } from './faq-bot.service';
import { FaqBotGateway } from './faq-bot.gateway';
import { QueryClassifierService } from './services/query-classifier.service';
import { KnowledgeRetrievalService } from './services/knowledge-retrieval.service';
import { AiStreamService } from './services/ai-stream.service';
import { FaqBotConsentService } from './services/faq-bot-consent.service';
import { FaqBotCurrencyService } from './services/faq-bot-currency.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [FaqBotController],
  providers: [
    FaqBotService,
    FaqBotGateway,
    QueryClassifierService,
    KnowledgeRetrievalService,
    AiStreamService,
    FaqBotConsentService,
    FaqBotCurrencyService,
  ],
  exports: [FaqBotService],
})
export class FaqBotModule {}
