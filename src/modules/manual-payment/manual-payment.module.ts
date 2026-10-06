import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../email-automation/email.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { TelegramModule } from '../telegram/telegram.module';  // ✅ Keep this import
import { ManualPaymentController } from './manual-payment.controller';
import { ManualPaymentService } from './manual-payment.service';

@Module({
  imports: [
    PrismaModule,
    UploadsModule,
    EmailModule,
    ConfigModule,
    TelegramModule,  // ✅ ADD HERE (NOT as a separate line)
  ],
  controllers: [ManualPaymentController],
  providers: [ManualPaymentService],
  exports: [ManualPaymentService],
})
export class ManualPaymentModule {}
