import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramTmaService } from './telegram-tma.service';
import { TelegramController } from './telegram.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../accounts/auth/auth.module';
import { ManualPaymentModule } from '../../payments/manual-payment/manual-payment.module';

@Module({
  imports: [PrismaModule, AuthModule, ManualPaymentModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramTmaService],
  exports: [TelegramService, TelegramTmaService],
})
export class TelegramModule {}
